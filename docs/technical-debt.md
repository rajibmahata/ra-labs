# Technical debt

Deliberate shortcuts, not bugs. Something that works correctly today but
will cost more to change later the longer it's left. Each entry needs a
cost estimate for paying it down now vs. later — without that, this becomes
a guilt list instead of a planning tool.

| Item | Why it was taken | Cost to fix now | Cost if deferred another sprint |
|---|---|---|---|
| Example: invoice status is a string, not an enum | Shipped before the full status set was confirmed | Small | Grows with every place that string gets compared — delete this row |
