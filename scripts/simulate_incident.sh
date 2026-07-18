#!/bin/bash
echo "🔥 Triggering simulated Grafana Alertmanager Incident..."

curl -X POST http://127.0.0.1:3000/api/grafana_webhook \
  -H "Content-Type: application/json" \
  -d '{
    "receiver": "zervox",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "HighAPILatency",
          "service": "api-gateway",
          "severity": "critical"
        },
        "annotations": {
          "summary": "High latency detected on API Gateway",
          "description": "API Gateway p99 latency is above 500ms for 5 minutes."
        }
      }
    ],
    "title": "[FIRING:1] HighAPILatency (api-gateway critical)"
  }'

echo -e "\n✅ Incident payload sent to Zervox API."
