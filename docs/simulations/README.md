# Simulations documentation index

Implementation and runbooks for Python simulations live in [`../../simulations/README.md`](../../simulations/README.md) (package layout, TimeCurve Monte Carlo, Burrow formulas).

## DOUB sale calibration (planning)

- **Module:** [`doub_sale_calibration`](../../simulations/doub_sale_calibration/) — FDV anchor, target **k** (DOUB per gross CL8Y) for a mintable sale model, **LinearCharmPrice** sample paths, and **referral** denominator sensitivity (canonical **5% + 5%** CHARM weight — [GitLab #53](https://gitlab.com/PlasticDigits/yieldomega/-/issues/53)).
- **Command:**

```bash
cd simulations
pip install -e '.[charts]'   # optional, for PNG output
PYTHONPATH=. python3 -m doub_sale_calibration --total-raise-cl8y 1000000 --out-dir /tmp/doub-cal
```

- **Invariants / checklist:** [`../testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md#doub-genesis-fdv-anchor-and-sale-economics-gitlab-53).
