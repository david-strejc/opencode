#!/bin/bash

echo "Testing Smart Content-Aware Hint Injection"
echo "==========================================="
echo ""

# Create a test session ID for continuity
SESSION_ID="test-hints-$(date +%s)"

echo "Test 1: Simple question (no hint expected)"
~/.opencode/bin/opencode run "What is 2+2?" -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo "Test 2: Debugging context (HINT EXPECTED - debugging category detected)"
~/.opencode/bin/opencode run "I'm getting an undefined error in my code" -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo "Test 3: Normal message (no hint)"
~/.opencode/bin/opencode run "Create a function to add two numbers" -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo "Test 4: Performance question (HINT EXPECTED - performance keywords)"
~/.opencode/bin/opencode run "My application is running very slow, how can I optimize it?" -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo "Test 5: Frustrated user (HINT EXPECTED - frustration detected)"
~/.opencode/bin/opencode run "This is so frustrating! Nothing works and I'm stuck!" -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo "Test 6: Security concern (HINT EXPECTED - security category)"
~/.opencode/bin/opencode run "How do I handle user authentication and passwords securely?" -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo "Test 7: Complex request (HINT EXPECTED - complexity detected)"
~/.opencode/bin/opencode run "I need to implement a distributed caching system with Redis that handles cache invalidation across multiple servers, supports TTL, implements cache warming strategies, and provides fallback mechanisms when the cache is unavailable. The system should also collect metrics and handle thundering herd problems." -m chatgpt/gpt-5 --session $SESSION_ID
echo -e "\n---\n"

echo ""
echo "Test Complete! Check the output above for injected hints."
echo "Hints should appear for messages 2, 4, 5, 6, and 7"
echo "Look for '💡 HINT:' in the prompts sent to the model"