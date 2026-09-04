package zervox.authz

import rego.v1

default allow := false

# Allow valid remediation actions when there are no deny violations
allow if {
    count(deny) == 0
    valid_action
}

# Define what constitutes a valid structural action
valid_action if {
    input.action == "restart_pod"
    input.resource == "pod"
    input.name != ""
    input.namespace != ""
}

valid_action if {
    input.action == "scale"
    input.resource == "deployment"
    input.name != ""
    input.namespace != ""
    input.target_replicas > 0
    input.target_replicas <= 10
}

valid_action if {
    input.action == "cordon"
    input.resource == "node"
    input.name != ""
}

valid_action if {
    input.action == "quarantine"
    input.resource == "networkpolicy"
    input.name != ""
    input.namespace != ""
}

valid_action if {
    input.action == "no_action"
}

# Rule 1: Never delete namespaces under any circumstances
deny contains msg if {
    input.action == "delete"
    input.resource == "namespace"
    msg := "CRITICAL: Namespace deletion is absolutely prohibited during autonomous execution."
}

# Rule 2: Never allow container shell execution / arbitrary command execution
deny contains msg if {
    input.command[_] == "exec"
    msg := "CRITICAL: Container shell execution is blocked."
}

deny contains msg if {
    input.action == "exec"
    msg := "CRITICAL: Container shell execution is blocked."
}

# Rule 3: Enforce maximum replica cap (max 10) to prevent cost & runaway blast radius
deny contains msg if {
    input.action == "scale"
    input.target_replicas > 10
    msg := sprintf("CRITICAL: Replica cap exceeded (requested %v, max allowed is 10).", [input.target_replicas])
}

# Rule 4: Prevent scaling below 1 replica autonomously
deny contains msg if {
    input.action == "scale"
    input.target_replicas < 1
    msg := "CRITICAL: Autonomous scale down to 0 replicas is prohibited."
}

# Rule 5: Protected namespaces guard
deny contains msg if {
    input.namespace == "kube-system"
    input.action != "no_action"
    msg := "CRITICAL: Modifications to kube-system namespace are prohibited."
}
