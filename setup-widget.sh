#!/bin/bash
# ═══════════════════════════════════════
#   Gorgias QA Evaluator Widget Setup
#   Run this ONCE to create the sidebar widget
# ═══════════════════════════════════════

GORGIAS_DOMAIN="${GORGIAS_DOMAIN:-osmozone.gorgias.com}"
GORGIAS_EMAIL="${GORGIAS_EMAIL}"
GORGIAS_API_KEY="${GORGIAS_API_KEY}"

if [ -z "$GORGIAS_EMAIL" ] || [ -z "$GORGIAS_API_KEY" ]; then
  echo "❌ Missing credentials. Run these first:"
  echo "  export GORGIAS_EMAIL=your-email"
  echo "  export GORGIAS_API_KEY=your-api-key"
  exit 1
fi

BASE="https://${GORGIAS_DOMAIN}/api"
AUTH="${GORGIAS_EMAIL}:${GORGIAS_API_KEY}"

echo ""
echo "═══════════════════════════════════════"
echo "  Gorgias QA Evaluator Widget Setup"
echo "═══════════════════════════════════════"
echo ""

# Step 1: Find integration
echo "🔍 Looking for QA integration..."
INTEGRATIONS=$(curl -s -u "${AUTH}" "${BASE}/integrations?type=http&limit=50")

echo "$INTEGRATIONS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data.get('data', data) if isinstance(data, dict) else data
found = None
for i in items:
    name = (i.get('name') or '').lower()
    url = (i.get('http',{}).get('url') or '').lower()
    desc = (i.get('description') or '').lower()
    print(f\"  - ID: {i['id']} | Name: {i.get('name')} | URL: {i.get('http',{}).get('url','')}\")
    if 'qa' in name or 'qa' in desc or 'gorgias-qa' in url or '/api/gorgias' in url:
        found = i['id']
if found:
    print(f\"\n✅ Found QA integration ID: {found}\")
    with open('/tmp/gorgias_integration_id', 'w') as f:
        f.write(str(found))
else:
    print('\n❌ Could not auto-detect. Check the list above and run:')
    print('  export INTEGRATION_ID=<the-id>')
    print('  Then re-run this script')
"

# Get integration ID
if [ -n "$INTEGRATION_ID" ]; then
  INT_ID="$INTEGRATION_ID"
elif [ -f /tmp/gorgias_integration_id ]; then
  INT_ID=$(cat /tmp/gorgias_integration_id)
  rm /tmp/gorgias_integration_id
else
  echo "❌ No integration found. Set INTEGRATION_ID manually."
  exit 1
fi

echo ""
echo "📦 Creating widget for integration ${INT_ID}..."
echo ""

# Step 2: Create widget
RESULT=$(curl -s -X POST "${BASE}/widgets" \
  -u "${AUTH}" \
  -H "Content-Type: application/json" \
  -d "{
  \"context\": \"ticket\",
  \"type\": \"http\",
  \"integration_id\": ${INT_ID},
  \"template\": {
    \"type\": \"wrapper\",
    \"widgets\": [
      {
        \"type\": \"card\",
        \"title\": \"📊 QA Evaluation\",
        \"path\": \"\",
        \"order\": 0,
        \"meta\": {
          \"displayCard\": true,
          \"link\": \"\",
          \"custom\": {
            \"links\": [
              {
                \"url\": \"https://gorgias-qa.vercel.app?ticket_id={{ticket_id}}\",
                \"label\": \"Open Full Dashboard\"
              }
            ]
          }
        },
        \"widgets\": [
          {\"type\":\"text\",\"title\":\"Status\",\"path\":\"status\",\"order\":0},
          {\"type\":\"text\",\"title\":\"Score\",\"path\":\"latest_score\",\"order\":1},
          {\"type\":\"text\",\"title\":\"Grade\",\"path\":\"latest_grade\",\"order\":2},
          {\"type\":\"text\",\"title\":\"Agent\",\"path\":\"latest_agent\",\"order\":3},
          {\"type\":\"text\",\"title\":\"Evaluator\",\"path\":\"latest_evaluator\",\"order\":4},
          {\"type\":\"text\",\"title\":\"Date\",\"path\":\"latest_date\",\"order\":5},
          {\"type\":\"text\",\"title\":\"Type\",\"path\":\"latest_auto\",\"order\":6},
          {\"type\":\"text\",\"title\":\"Violation\",\"path\":\"latest_violation\",\"order\":7},
          {
            \"type\": \"card\",
            \"title\": \"Category Scores\",
            \"path\": \"\",
            \"order\": 8,
            \"meta\": {\"displayCard\": true},
            \"widgets\": [
              {\"type\":\"text\",\"title\":\"Soft Skills (20%)\",\"path\":\"latest_soft_skills\",\"order\":0},
              {\"type\":\"text\",\"title\":\"Issue Understanding (30%)\",\"path\":\"latest_issue_understanding\",\"order\":1},
              {\"type\":\"text\",\"title\":\"Product & Process (30%)\",\"path\":\"latest_product_process\",\"order\":2},
              {\"type\":\"text\",\"title\":\"Tools Utilization (20%)\",\"path\":\"latest_tools_utilization\",\"order\":3}
            ]
          },
          {\"type\":\"text\",\"title\":\"Feedback\",\"path\":\"latest_feedback\",\"order\":9},
          {
            \"type\": \"list\",
            \"path\": \"evaluations\",
            \"order\": 10,
            \"meta\": {\"limit\": \"5\", \"orderBy\": \"\"},
            \"widgets\": [
              {
                \"type\": \"card\",
                \"title\": \"{{agent}} — {{grade}} ({{score}})\",
                \"meta\": {\"displayCard\": true},
                \"widgets\": [
                  {\"type\":\"text\",\"title\":\"Evaluator\",\"path\":\"evaluator\",\"order\":0},
                  {\"type\":\"text\",\"title\":\"Date\",\"path\":\"date\",\"order\":1},
                  {\"type\":\"text\",\"title\":\"Soft Skills\",\"path\":\"soft_skills\",\"order\":2},
                  {\"type\":\"text\",\"title\":\"Issue Understanding\",\"path\":\"issue_understanding\",\"order\":3},
                  {\"type\":\"text\",\"title\":\"Product & Process\",\"path\":\"product_process\",\"order\":4},
                  {\"type\":\"text\",\"title\":\"Tools Utilization\",\"path\":\"tools_utilization\",\"order\":5},
                  {\"type\":\"text\",\"title\":\"Feedback\",\"path\":\"feedback\",\"order\":6}
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}")

echo "$RESULT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'id' in data:
        print(f\"✅ Widget created! ID: {data['id']}\")
        print()
        print('📋 Next steps:')
        print('   1. Open any ticket in Gorgias')
        print('   2. Click the ⚙️ cog icon at the top-right of the sidebar')
        print('   3. Drag QA Evaluation widget into your desired position')
        print('   4. Click Save Changes')
    else:
        print(f'❌ Error: {json.dumps(data, indent=2)}')
except:
    print(sys.stdin.read())
"
