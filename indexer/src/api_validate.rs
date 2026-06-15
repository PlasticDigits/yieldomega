// SPDX-License-Identifier: AGPL-3.0-or-later

//! Shared HTTP path/query validation for `0x`-prefixed 20-byte addresses (GitLab #329).

/// `true` when `s` is `0x` + exactly 40 ASCII hex digits (42 chars total).
pub fn valid_0x_address20(s: &str) -> bool {
    s.starts_with("0x")
        && s.len() == 42
        && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::valid_0x_address20;

    #[test]
    fn valid_0x_address20_accepts_20_byte_hex() {
        assert!(valid_0x_address20(
            "0xdddddddddddddddddddddddddddddddddddddddd"
        ));
    }

    #[test]
    fn valid_0x_address20_rejects_invalid() {
        assert!(!valid_0x_address20("0xbad"));
        assert!(!valid_0x_address20("not-an-address"));
        assert!(!valid_0x_address20(
            "0xgggggggggggggggggggggggggggggggggggggggg"
        ));
    }
}
