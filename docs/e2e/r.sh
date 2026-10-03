#!/bin/bash
# usage: ./r.sh '[["goto","/x"],["page"]]'
rm -f /tmp/repl/out; echo "$1" > /tmp/repl/cmd.tmp && mv /tmp/repl/cmd.tmp /tmp/repl/cmd
for i in $(seq 1 600); do [ -f /tmp/repl/out ] && break; sleep 0.5; done
python3 -c "import json;[print(json.dumps(x)[:1500]) for x in json.load(open('/tmp/repl/out'))]"
