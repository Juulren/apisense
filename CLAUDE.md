# Workflow rules

- Delegate every repo search and test run to the Haiku 5.5 subagents (`search`, `grep`, `audit`) to keep the main context small.
- Sonnet 5.5 writes code and applies fixes. Consult Opus 5.5 only: (1) before a plan locks, (2) when the same error appears twice, (3) before calling the work done.
