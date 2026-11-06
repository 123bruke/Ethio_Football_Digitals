; PitchSide MeTTa explanation rules.
; These rules are intended for transparent explanation of probability bands only.
; They do not train the statistical model and cannot authorize user/account actions.

(= (confidence-band low) "uncertain")
(= (confidence-band medium) "moderate")
(= (confidence-band high) "stronger-signal")

(= (prediction-guidance uncertain)
   "The model is uncertain; several match outcomes remain plausible.")
(= (prediction-guidance moderate)
   "The model has a modest preference, but the match remains difficult to call.")
(= (prediction-guidance stronger-signal)
   "The model has a clearer preference, but this is not a guarantee.")
