# Demo sample projects

Twelve small projects, zipped in [`zips/`](zips), for trying CodeSentinel without your own code.
In the app open **New analysis → Upload project** and drop one of the zip files in.

The code is synthetic: a legacy "order pricing" domain written in each supported language, with one
deliberately tangled function (long, deeply branched) next to small, clean helpers. Every file compiles or
parses (Python, JavaScript, C, C++ and Java were checked with their compilers).

| Zip | Language | What it shows | Result with the default model |
|---|---|---|---|
| `01_python_clean_toolkit` | Python | Small, well-documented helpers | Grade A (99), no risky functions |
| `02_python_legacy_billing` | Python | One 187-line, complexity-86 function plus a mid-size one | Grade C (71), 1 high, 1 medium |
| `03_java_shop` | Java | Legacy order processor with clean value classes | Grade C (73), 2 high |
| `04_c_expression_parser` | C | Hand-written tokenizer with deep nesting | Grade B (80), 1 high, 1 medium |
| `05_cpp_batch_scheduler` | C++ | Scheduler with a long rule chain, clean matrix class | Grade C (77), 2 high |
| `06_javascript_cart` | JavaScript | Cart pricing, clean formatting helpers | Grade C (71), 2 high |
| `07_typescript_pricing` | TypeScript | Typed pricing engine, small validators | Grade C (77), 2 high |
| `08_go_router` | Go | Shipment pricing, numeric helpers | Grade C (75), 2 high |
| `09_csharp_invoicing` | C# | Invoice service, small record class | Grade D (68), 2 high |
| `10_polyglot_demo` | All eight | 18 files across every language | Grade B (81), 14 high, 2 medium |
| `11_refactor_before` | Python | The legacy pricing function | Grade D (65), 1 high |
| `12_refactor_after` | Python | The same behaviour split into small functions | Grade A (95), 0 high |

Regenerate everything with `make samples` (or `python samples/generate_samples.py`).

## Suggested demo flow

1. Run `01_python_clean_toolkit`, then `02_python_legacy_billing`, and compare the Overview pages.
2. Run `10_polyglot_demo` and use **Results → search** and the risk filter to show per-language hotspots.
3. Run `11_refactor_before` and then `12_refactor_after`, open **History**, tick both runs and read the
   comparison: the high-risk count drops from 1 to 0 and the grade moves from D to A.
4. Open the top function of any legacy sample to show the gauge, drivers and refactoring hints.

## Notes

- Results above are for the default model (Python-native logistic regression). Other models and the NASA
  family will rank the same functions differently.
- Comment percentage is only measured for Python files; other languages always report 0%.
- The models were trained on Python functions, so scores for other languages are a relative ranking of
  size and complexity, not calibrated defect probabilities.
