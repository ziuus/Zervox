package zervox.authz

default allow = false

# Allow valid remediation actions when there are no deny violations
allow {
    count(deny) == 0
    valid_action
}

# Define what constitutes a valid structural action
valid_action {
    input.action == "restart_pod"
    input.resource == "pod"
    input.name != ""
    input.namespace != ""
}

valid_action {
    input.action == "scale"
    input.resource == "deployment"
    input.name != ""
    input.namespace != ""
    input.target_replicas > 0
    input.target_replicas <= 10
}

valid_action {
    input.action == "cordon"
    input.resource == "node"
    input.name != ""
}

valid_action {
    input.action == "no_action"
}

# Rule 1: Never delete namespaces under any circumstances
deny[msg] {
    input.action == "delete"
    input.resource == "namespace"
    msg := "CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution."
}

# Rule 2: Never allow container shell execution / arbitrary command execution
deny[msg] {
    input.command[_] == "exec"
    msg := "CRITICAL: Container shell execution is blocked."
}

deny[msg] {
    input.action == "exec"
    msg := "CRITICAL: Container shell execution is blocked."
}

# Rule 3: Enforce maximum replica cap (max 10) to prevent cost & runaway blast radius
deny[msg] {
    input.action == "scale"
    input.target_replicas > 10
    msg := sprintf("CRITICAL: Replica cap exceeded (requested %v, max allowed is 10).", [input.target_replicas])
}

# Rule 4: Prevent scaling below 1 replica autonomously
deny[msg] {
    input.action == "scale"
    input.target_replicas < 1
    msg := "CRITICAL: Autonomous scale down to 0 replicas is prohibited."
}

# Rule 5: Protected namespaces guard
deny[msg] {
    input.namespace == "kube-system"
    input.action != "no_action"
    msg := "CRITICAL: Modifications to kube-system namespace are prohibited."
}
