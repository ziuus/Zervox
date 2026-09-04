#!/usr/bin/env bash

echo "Waiting for zervox-primary to be available on port 8080..."
while ! curl -s http://localhost:8080/api/status > /dev/null; do
    sleep 2
done
echo "Zervox primary is UP!"

echo "Firing test alert to Zervox Webhook..."
curl -s -X POST http://localhost:8080/api/grafana_webhook \
    -H "Content-Type: application/json" \
    -H "x-api-key: zervox-secret-token" \
    -d '{
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "PodCrashLooping",
                    "namespace": "default",
                    "pod": "victim-api-6d7c8f",
                    "severity": "critical"
                },
                "annotations": {
                    "summary": "Pod victim-api-6d7c8f in CrashLoopBackOff"
                }
            }
        ]
    }' | jq '.' || true

echo "Checking Zervox status to verify incident was recorded..."
curl -s http://localhost:8080/api/status | jq '.recent_incidents' || true

echo "Waiting for Next.js frontend to be available on port 3000..."
while ! curl -s http://localhost:3000 > /dev/null; do
    sleep 5
done
echo "Next.js frontend is UP!"
