If you touch a workflow and an existing action used in the repo is stale, upgrade it and keep versions consistent across workflows.
For new actions, use the current stable major.
Do not set default values for actions in env/with, rely on default values being set.

Order keys in steps like this:

1. id
2. name
3. working-directory
4. env
5. run

Example:

```yaml
- id: deploy
  name: Deploy
  working-directory: apps/api
  env:
    APP_ENV: beta
  run: ./run "deploy:${APP_ENV}"
```
