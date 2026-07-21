When doing run args please follow this pattern. Where a function called runCommands is at the top always and it defines what other function are called based on args.

```bash
#!/usr/bin/env bash
set -euo pipefail

runCommands() {
  if [[ "${1}" == "command1" ]]; then
    command1
  elif [[ "${1}" == "command2" ]]; then
    command2
  else
    echo "Please provide one of the following commands: command1, command2"
    exit 1
  fi
}

command1() {
 # code
}

command2() {
 # code
}

runCommands "${@}"
```

+Inject variables into strings like this `"${VAR}"`.
Avoid hasty abstraction, if var is only ref once and it's not too long, then inline the var.
