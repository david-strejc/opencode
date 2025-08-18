#!/bin/bash

# Monitor auth.json file changes
echo "🔍 Monitoring ~/.local/share/opencode/auth.json for changes..."
echo "Press Ctrl+C to stop"
echo "=" 

# Show current state
echo "📋 Current auth.json contents:"
cat ~/.local/share/opencode/auth.json | jq -C . 2>/dev/null || cat ~/.local/share/opencode/auth.json
echo ""

# Watch for changes
inotifywait -m ~/.local/share/opencode/auth.json -e modify,create,delete --format '%T %e %f' --timefmt '%H:%M:%S' | while read time event file; do
    echo "🔄 [$time] File $event detected!"
    echo "📋 New contents:"
    cat ~/.local/share/opencode/auth.json | jq -C . 2>/dev/null || cat ~/.local/share/opencode/auth.json
    echo ""
done