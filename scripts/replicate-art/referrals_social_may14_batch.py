#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate a four-image referrals social infographic pack.

This intentionally uses one Replicate create attempt per image. If polling flakes,
investigate the logged prediction instead of retrying and duplicating generations.
Final readable infographic copy is overlaid locally so the text is exact.
"""

from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402


OUT_DIR = ga.DEFAULT_OUT / "gen_social" / "referrals-may14"

FORBIDDEN_INFOGRAPHIC_PROMPT_PHRASES = (
    "background only",
    "not an infographic layout",
    "no readable text",
    "no text",
    "do not render readable",
    "blank signboards",
    "empty infographic panels",
)


@dataclass(frozen=True)
class ReferralSocialJob:
    slug: str
    title: str
    subject: str
    kicker: str
    headline: str
    subhead: str
    panels: tuple[str, ...]
    footer: str


def build_prompt(job: ReferralSocialJob, *, using_refs: bool) -> str:
    reference_block = (
        "Reference images are supplied as input_images in this order:\n"
        "(1) style.png for the Yieldomega blocky arcade fantasy world, mascots, green-gold palette, chunky outlines, glossy toy depth, and cheerful magical tone.\n"
        "(2) token-logo.png for canonical coin, badge, and DOUB-style hat-token details.\n"
        "Keep the same brand universe without making a direct edit or near-duplicate of either reference."
        if using_refs
        else "No reference images are available for this run. Follow the written Yieldomega style guide closely: blocky arcade fantasy, green-gold magical finance, glossy hat-token currency, adult playful mascots, thick outlines, and cheerful high-clarity staging."
    )
    return f"""
{ga.STYLE_GUIDE}

{reference_block}

Campaign concept:
A four-card Yieldomega referrals education series based on what the current `/referrals` app actually does: the Referrals page hero, the three overview cards (claim your sigil, send a trail, grow CHARM), the wallet-gated register section, the "Register & burn CL8Y" flow, copied share links, "Your referral CHARM", and the guide leaderboard.

Text production rule:
CRITICAL — this must be a finished social infographic, not silent key art. Render a clear poster layout with integrated art, readable English typography, short headings, panel labels, arrows, badges, and callout cards. An image with only background art or blank panels is wrong. Keep text large, high-contrast, and scannable. The Python compositor also overlays the exact approved copy after generation, so leave readable layout zones, but do not leave them empty.

Required on-image copy to include in the generated poster:
- Kicker: "{job.kicker}"
- Headline: "{job.headline}"
- Subhead: "{job.subhead}"
- Panels: {" | ".join(job.panels)}
- Footer note: "{job.footer}"

Accuracy constraints for referrals:
- A Yieldomega referral code is registered onchain in ReferralRegistry.
- Registration burns 1 CL8Y on successful registration.
- Codes are 3-16 ASCII lowercase letters or digits after normalization.
- One code per wallet; each code has at most one owner.
- The first successful onchain registration wins the code.
- Share links can use ?ref={{code}} or /timecurve/{{code}}.
- TimeCurve applies referrals per qualifying buy by codeHash; invalid or self-referrals revert.
- A referred buy adds 5 percent CHARM weight to the referrer and 5 percent CHARM weight to the buyer.
- Referral rewards are CHARM weight, not a direct wallet payout.
- Dashboard earnings and leaderboards are derived from indexed ReferralApplied events.
- Do not imply guaranteed returns, guaranteed wins, offchain authority, legal advice, or pressure to participate.

Image title: {job.title}

Subject and composition:
{job.subject.strip()}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def validate_infographic_prompts(selected: list[ReferralSocialJob]) -> None:
    """Fail fast if this infographic batch drifts back into no-text/key-art prompting."""
    haystacks = [build_prompt(job, using_refs=True).lower() for job in selected]
    for job in selected:
        haystacks.append(job.subject.lower())
    for phrase in FORBIDDEN_INFOGRAPHIC_PROMPT_PHRASES:
        needle = phrase.lower()
        for haystack in haystacks:
            if needle in haystack:
                raise RuntimeError(
                    f"Referrals social infographic prompt contains forbidden no-text/key-art phrase: {phrase!r}"
                )


def jobs() -> list[ReferralSocialJob]:
    return [
        ReferralSocialJob(
            slug="01-share-trail",
            title="Earn By Sharing",
            subject="""
Wide 3:2 finished infographic poster. Layout: bold headline band at top, three labeled step cards along the bottom, illustrated action scene through the middle. A friendly adult bunny-leprechaun guide shares a glowing referral trail from a code sigil toward a TimeCurve buy kiosk where a new buyer arrives with a MegaETH wallet lantern. CHARM crystal beams arc back to both the guide and buyer. Use readable arcade typography for the headline, subhead, and step cards. Include arrows, badges, small event-log callouts, voxel hills, rainbow sky, hat-coins, and chain-link sparkles. The card should clearly explain referrals earn CHARM weight by sharing.
""",
            kicker="YIELDOMEGA REFERRALS",
            headline="Earn by sharing.",
            subhead="Register a guide code, share a TimeCurve trail, and qualifying buys add CHARM weight to both sides.",
            panels=(
                "Claim your sigil",
                "Send a referral trail",
                "Grow CHARM together",
            ),
            footer="Referral rewards are CHARM weight, not a direct wallet payout.",
        ),
        ReferralSocialJob(
            slug="02-what-is-code",
            title="What Is a Referral Code",
            subject="""
Wide 3:2 finished infographic poster explaining a Yieldomega referral code. Layout: bold question headline at top, central ReferralRegistry vault with code sigil and hash crystal, five readable fact tiles around it. Icons: length ruler, letters/digits blocks, one-wallet badge, CL8Y burn flame, first-successful-registration flag, TimeCurve codeHash check. Include a red-bearded leprechaun registrar and adult bunny-leprechaun guide beside the vault. Use readable arcade typography, rich green-gold lighting, coins, chain links, arrows, and sparkles. The card should feel like product education, not just fantasy art.
""",
            kicker="REFERRAL CODE BASICS",
            headline="What is a Yieldomega referral code?",
            subhead="A short onchain name that resolves to your wallet through ReferralRegistry.",
            panels=(
                "3-16 lowercase letters or digits",
                "One code per wallet",
                "1 CL8Y burn to register",
                "First successful registration wins",
                "TimeCurve checks the codeHash",
            ),
            footer="Share links pass the readable code. The chain stores ownership and applies the referral.",
        ),
        ReferralSocialJob(
            slug="03-sign-up",
            title="Sign Up With 1 CL8Y",
            subject="""
Wide 3:2 finished onboarding infographic poster. Layout: large URL headline at top, stylized app-screen frame for yieldomega.com/referrals in the middle, four numbered step cards at the bottom. Show a MegaETH wallet portal, one large CL8Y token moving into an emerald burn flame, a code input sigil forming above a chain-confirmation block, and an adult bunny-leprechaun host gesturing toward the process. Use readable arcade typography for the URL, 1 CL8Y requirement, and the four steps: connect wallet, pick code, approve 1 CL8Y, register and burn onchain.
""",
            kicker="START HERE",
            headline="Go to yieldomega.com/referrals",
            subhead="Have 1 CL8Y in your MegaETH wallet, then claim your guide code.",
            panels=(
                "1. Connect MegaETH wallet",
                "2. Pick a 3-16 character code",
                "3. Approve 1 CL8Y",
                "4. Register and burn onchain",
            ),
            footer="The 1 CL8Y burn is paid only if registration succeeds.",
        ),
        ReferralSocialJob(
            slug="04-share-check-earnings",
            title="Share and Check Earnings",
            subject="""
Wide 3:2 finished infographic poster showing how to share and check earnings. Layout: headline at top, left side share-link panel with two readable link formats, right side earnings dashboard with guide CHARM, traveler CHARM, combined CHARM, and a compact guide leaderboard. A registered guide code sigil sends two glowing share trails through the Yieldomega landscape toward a TimeCurve kiosk. Event ribbons flow from the kiosk into the earnings board made of CHARM crystals, wallet blockies, and a guide podium. Use readable arcade typography, arrows, badges, and dashboard labels.
""",
            kicker="AFTER YOU REGISTER",
            headline="Share links. Check earnings.",
            subhead="Copy your referral trail, then track CHARM from recorded buys.",
            panels=(
                "Share yieldomega.com/?ref=yourcode",
                "Or share yieldomega.com/timecurve/yourcode",
                "Track guide + traveler CHARM",
                "Leaderboard uses recorded buys",
            ),
            footer="CL8Y notionals in the app are illustrative. Referral earnings are CHARM weight.",
        ),
    ]


def _font_path(bold: bool) -> str | None:
    candidates = (
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        ]
        if bold
        else [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        ]
    )
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    return None


def _font(size: int, *, bold: bool = False):
    from PIL import ImageFont

    path = _font_path(bold)
    if path:
        return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def _wrap(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = word if not line else f"{line} {word}"
        if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def _draw_text_box(draw, xy, text: str, font, fill, max_width: int, line_gap: int = 6) -> int:
    x, y = xy
    for line in _wrap(draw, text, font, max_width):
        draw.text((x, y), line, font=font, fill=fill)
        y += draw.textbbox((0, 0), line, font=font)[3] + line_gap
    return y


def overlay_text(path: Path, job: ReferralSocialJob) -> None:
    from PIL import Image, ImageDraw

    img = Image.open(path).convert("RGBA")
    w, h = img.size
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    margin = int(w * 0.045)
    gold = (255, 216, 88, 255)
    cream = (255, 248, 218, 255)
    mint = (176, 255, 196, 255)
    ink = (9, 20, 25, 246)
    panel = (8, 27, 31, 238)
    panel_alt = (25, 54, 40, 240)
    stroke = (2, 8, 10, 255)

    title_font = _font(max(38, int(w * 0.04)), bold=True)
    kicker_font = _font(max(22, int(w * 0.018)), bold=True)
    sub_font = _font(max(24, int(w * 0.023)), bold=True)
    panel_font = _font(max(21, int(w * 0.019)), bold=True)
    foot_font = _font(max(18, int(w * 0.017)), bold=False)

    hero_w = int(w * 0.9)
    hero_h = int(h * 0.34)
    draw.rounded_rectangle(
        (margin, margin, margin + hero_w, margin + hero_h),
        radius=int(w * 0.025),
        fill=ink,
        outline=gold,
        width=max(3, int(w * 0.004)),
    )
    tx = margin + int(w * 0.025)
    ty = margin + int(h * 0.025)
    draw.text((tx, ty), job.kicker, font=kicker_font, fill=mint, stroke_width=2, stroke_fill=stroke)
    ty += int(h * 0.045)
    ty = _draw_text_box(
        draw,
        (tx, ty),
        job.headline,
        title_font,
        cream,
        hero_w - int(w * 0.05),
        line_gap=4,
    )
    ty += int(h * 0.01)
    _draw_text_box(draw, (tx, ty), job.subhead, sub_font, gold, hero_w - int(w * 0.05), line_gap=7)

    card_top = int(h * 0.43)
    card_gap = int(w * 0.016)
    panel_count = len(job.panels)
    if panel_count <= 3:
        columns = panel_count
    else:
        columns = 2
    rows = (panel_count + columns - 1) // columns
    usable_w = w - margin * 2 - card_gap * (columns - 1)
    card_w = usable_w // columns
    footer_h = int(h * 0.09)
    footer_y = h - margin - footer_h
    grid_h = footer_y - card_top - int(h * 0.025)
    row_gap = int(h * 0.016)
    if rows == 1:
        card_h = min(int(h * 0.18), grid_h)
    elif rows == 2:
        card_h = min(int(h * 0.14), (grid_h - row_gap) // 2)
    else:
        card_h = min(int(h * 0.11), (grid_h - row_gap * (rows - 1)) // rows)
    for idx, text in enumerate(job.panels):
        row = idx // columns
        col = idx % columns
        x0 = margin + col * (card_w + card_gap)
        y0 = card_top + row * (card_h + row_gap)
        x1 = x0 + card_w
        fill = panel_alt if idx % 2 else panel
        draw.rounded_rectangle(
            (x0, y0, x1, y0 + card_h),
            radius=int(w * 0.018),
            fill=fill,
            outline=(91, 240, 145, 240),
            width=max(2, int(w * 0.0025)),
        )
        _draw_text_box(
            draw,
            (x0 + int(w * 0.014), y0 + int(h * 0.022)),
            text,
            panel_font,
            cream,
            card_w - int(w * 0.028),
            line_gap=7,
        )

    draw.rounded_rectangle(
        (margin, footer_y, w - margin, h - margin),
        radius=int(w * 0.018),
        fill=(6, 14, 20, 242),
        outline=(255, 216, 88, 210),
        width=max(2, int(w * 0.0025)),
    )
    _draw_text_box(
        draw,
        (margin + int(w * 0.018), footer_y + int(h * 0.024)),
        job.footer,
        foot_font,
        cream,
        w - margin * 2 - int(w * 0.036),
        line_gap=5,
    )

    combined = Image.alpha_composite(img, overlay)
    combined.convert("RGB").save(path, format="PNG", optimize=True)


def write_manifest(selected: list[ReferralSocialJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "reference_images_used": using_refs,
        "local_text_overlay": True,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "output": f"{job.slug}.png",
                "kicker": job.kicker,
                "headline": job.headline,
                "subhead": job.subhead,
                "panels": list(job.panels),
                "footer": job.footer,
                "subject": job.subject.strip(),
            }
            for job in selected
        ],
    }
    (OUT_DIR / "prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "README.md").write_text(
        "# Referrals Social Infographics\n\n"
        "Generated with `scripts/replicate-art/referrals_social_may14_batch.py` using one "
        "Replicate create attempt per image. Final readable copy is overlaid locally for exact spelling. "
        "See `prompts.json` for prompts and text.\n",
        encoding="utf-8",
    )


def main() -> int:
    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN unset.", file=sys.stderr)
        return 1
    os.environ["REPLICATE_API_TOKEN"] = token

    selected = jobs()
    using_refs = ga.DEFAULT_STYLE_REF.is_file() and ga.DEFAULT_TOKEN_REF.is_file()
    validate_infographic_prompts(selected)
    write_manifest(selected, using_refs=using_refs)

    resume_existing = os.environ.get("YIELDOMEGA_REFERRALS_SOCIAL_RESUME", "").strip() == "1"
    existing_outputs = [OUT_DIR / f"{job.slug}.png" for job in selected if (OUT_DIR / f"{job.slug}.png").exists()]
    if existing_outputs and not resume_existing:
        print(
            "Refusing to run with existing PNG outputs; remove them first for a fresh one-attempt set "
            "or set YIELDOMEGA_REFERRALS_SOCIAL_RESUME=1 to skip existing files.",
            file=sys.stderr,
        )
        for path in existing_outputs:
            print(f"  existing: {path}", file=sys.stderr)
        return 2

    to_run: list[tuple[int, ReferralSocialJob]] = []
    for idx, job in enumerate(selected, start=1):
        output_path = OUT_DIR / f"{job.slug}.png"
        if output_path.exists():
            print(f"[{idx}/{len(selected)}] {job.slug} exists; resume mode skipping to avoid duplicate generation.")
            continue
        to_run.append((idx, job))

    def run_one(idx: int, job: ReferralSocialJob) -> None:
        print(f"[{idx}/{len(selected)}] {job.slug}")
        ga.run_job(
            job.slug,
            "3:2",
            "png",
            "opaque",
            job.subject,
            OUT_DIR,
            ga.DEFAULT_STYLE_REF,
            ga.DEFAULT_TOKEN_REF,
            "high",
            "low",
            90,
            1,
            1,
            20.0,
            False,
            not using_refs,
            custom_prompt=build_prompt(job, using_refs=using_refs),
            max_wall_seconds=float(os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "900")),
            poll_progress=True,
            log_monitor=True,
        )
        output_path = OUT_DIR / f"{job.slug}.png"
        overlay_text(output_path, job)

    with ThreadPoolExecutor(max_workers=max(1, len(to_run))) as executor:
        futures = {executor.submit(run_one, idx, job): job.slug for idx, job in to_run}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                future.result()
                print(f"[{slug}] complete")
            except Exception as exc:
                print(f"[{slug}] failed: {exc!s}", file=sys.stderr)
                raise

    print(f"Wrote referral social images to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
