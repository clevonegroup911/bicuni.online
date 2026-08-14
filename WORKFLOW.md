# BICUNI — Standard Delivery Pipeline

```text
Founder / ChatGPT Work
        |
        v
   TASK SPEC
        |
        v
     CURSOR
   implementation
        |
        v
  LOCAL QUALITY GATE
        |
        v
      CODEX
  independent review
        |
        +---- FAIL ----> targeted fixes ----+
        |                                   |
        +--------------- re-test <----------+
        |
       PASS
        |
        v
      GIT COMMIT
        |
        v
   PULL REQUEST / CI
        |
        v
   STAGING / SMOKE TEST
        |
        v
   PRODUCTION DEPLOY
        |
        v
  MONITOR + DOCUMENT
```

## Règle

Une tâche ne doit pas naviguer indéfiniment ChatGPT -> Cursor -> ChatGPT -> Codex -> ChatGPT.

Le contexte permanent vit dans le dépôt.

Le prompt de chaque tâche ne contient que ce qui change.
