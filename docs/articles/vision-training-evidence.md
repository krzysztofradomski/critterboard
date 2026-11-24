# Vision training draft: evidence audit

#ml #training #review

Checked 22 October 2026 against local source revision `8ffe387ef064bc3f5e04010a2f4383710bfda0e9`, archived manifests and the local `field-v7-results` / `household-v2-results` branches. This is a document and artifact audit; training and inference were not rerun.

Companion to [[vision-pipeline-draft]]. The draft supersedes the two missing article paths previously listed in [[../README]]. No article files were found at those paths in this checkout or in the available Git history.

## Findings that affect interpretation

### 1. Later split boundaries do not cover checkpoint ancestry

The household retraining script explicitly loads commercial-v1 with `--init`. Its log reports 896 carried-over classifier rows. V3 continues from v2; v7 continues from v3.

Comparing credits manifests by exact photo ID gives 6,971 later test records and 4,210 later validation records also marked `train` in commercial-v1. The test overlap spans 853 species; the validation overlap spans 806.

These are metadata overlaps, not proof of every image actually consumed during training. The commercial-v1 card itself distinguishes selection and available-image counts. Nevertheless, “split by photographer” must not be presented as proof that the complete model history never saw the later test set. The draft labels scores as development results and does not estimate the size of the bias.

Recompute from the repository root, using only the Python standard library:

```python
import csv
import gzip
from pathlib import Path

root = Path("training/vision/results")

def read_credits(run):
    with gzip.open(root / run / "credits.csv.gz", "rt") as stream:
        return list(csv.DictReader(stream))

earlier = read_credits("commercial-1k-v1")
later = read_credits("household-v3")
trained_ids = {r["photo_id"] for r in earlier if r["split"] == "train"}
for split in ("val", "test"):
    rows = [r for r in later if r["split"] == split]
    overlap = [r for r in rows if r["photo_id"] in trained_ids]
    print(split, len(rows), len(overlap))
# val 15010 4210
# test 24599 6971
```

### 2. Synthetic benchmark limitations

`field_eval.py` imports `paste` from `field_aug.py`. Train and test share the feathered compositing method, though their intended photo partitions and background photo IDs differ. Test selection takes the first 500 species; this is not a random sample across all 1,004 classes. Reused backgrounds and related photos also mean prediction counts should not automatically be treated as independent observations for uncertainty estimates.

No matched continuation without augmentation is recorded in this comparison. The draft avoids attributing the entire gain specifically to compositing and avoids reporting a real-phone accuracy claim.

### 3. Calibration wording

`field.json` records global T = 1.0, NLL before/after = 2.737114667892456, and per-condition best temperatures 0.85, 0.90, 1.10 and 1.15. The search in `calibrate.py` tests temperatures from 0.5 to 3.0 in steps of 0.05. T = 1.0 is a grid-search result for that objective, not proof of calibrated confidence or unknown-species rejection.

### 4. Counts in cards and artifacts differ

| Item | Evidence | Treatment in draft |
| --- | --- | --- |
| Source photo records | Credits: 248,378, split 208,769 / 15,010 / 24,599 | Clearly labelled manifest counts. |
| V7 available images | Archived `report.json`: 208,628 / 15,006 / 24,595, total 248,229 | Reported separately from source records. |
| Missing images | Difference is 149; card says 142 | Exact missing-image narrative omitted pending reconciliation. |
| Backgrounds | CSV has 800 rows: 624 train / 176 test; card says 799 usable: 623 / 176 | Draft does not assert an exact usable background count; resolve against downloaded run inventory. |
| Learning rate | `--lr 1e-4`, parameter groups multiply by 0.5 and 5 | Group rates stated explicitly; command argument not called the uniform learning rate. |
| Degradation | Synthetic branch always degrades; outer branch adds 30% probability | Draft explains possible double degradation. |

The audit does not silently revise the historical model cards. Their stronger evaluation language and count discrepancies remain follow-up documentation work once lineage and run inventories are reconciled.

## Numerical checks

- Clean comparison in `field.json`: v3 top-1 0.8282171173002643, top-3 0.9306363081927221; v7 top-1 0.8243138849359626, top-3 0.9271803212034967.
- Four synthetic condition rows in the draft match the unscaled v3 and v7 records, each with n = 500.
- Small/tap v7 direct rate 0.268 × 500 = 134; precision 0.8656716417910447 × 134 = 116 correct, 18 incorrect.
- Two epoch durations: 187.429758477211 + 163.3901177684466 = 350.8198762456576 minutes, about 5 h 51 min.
- Host export latency is 94.7 ms/image, not an Android/iOS measurement or scan latency.

## Review and publication readiness

- [x] Assemble the draft from existing documentation and inspect scripts where wording depends on behaviour.
- [x] Compare main numerical claims with recorded JSON and manifests.
- [x] Explain checkpoint ancestry, synthetic-data limits and absent real-phone validation.
- [x] Keep reviewer questions answerable without an Android release.
- [ ] Reconcile usable image/background counts against the original run inventory before offering an exact reproduction recipe.
- [ ] Checkpoint/data-lineage audit: identify all ancestor exposure and establish an untouched evaluation protocol.
- [ ] Add a labelled real-photo comparison when evidence exists; do not substitute generated examples as proof of field performance.
- [ ] Before public posting, convert repository-relative links to links at the published revision and verify access to artifact branches.
- [ ] Author reviews the first-person draft; collect external technical feedback and record resulting decisions.

External review and publication have not happened as part of this drafting task. Outreach preparation is kept outside this public repository.
