/**
 * Gorgias Widget Setup Script
 * 
 * Run this ONCE to create the QA Evaluator widget in your Gorgias sidebar.
 * 
 * Usage:
 *   node setup-widget.js
 * 
 * Required env vars (or edit the values below):
 *   GORGIAS_DOMAIN=osmozone.gorgias.com
 *   GORGIAS_EMAIL=your-email@example.com
 *   GORGIAS_API_KEY=your-api-key
 * 
 * Steps:
 *   1. Find the integration ID of your existing "AI QA Evaluator" HTTP integration
 *   2. Create a widget linked to that integration
 *   3. The widget will appear in the ticket sidebar
 *   4. Drag it into position using Gorgias sidebar editor (cog icon)
 */

const GORGIAS_DOMAIN = process.env.GORGIAS_DOMAIN || 'osmozone.gorgias.com';
const GORGIAS_EMAIL = process.env.GORGIAS_EMAIL || '';
const GORGIAS_API_KEY = process.env.GORGIAS_API_KEY || '';

const auth = Buffer.from(`${GORGIAS_EMAIL}:${GORGIAS_API_KEY}`).toString('base64');
const BASE_URL = `https://${GORGIAS_DOMAIN}/api`;

async function gorgiasAPI(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function findIntegration() {
  console.log('🔍 Looking for existing AI QA Evaluator integration...\n');
  const { status, data } = await gorgiasAPI('GET', '/integrations?type=http&limit=50');
  
  if (status !== 200) {
    console.error('❌ Failed to list integrations:', status, data);
    return null;
  }
  
  const integrations = data.data || data;
  const match = integrations.find(i => 
    i.name?.toLowerCase().includes('qa') || 
    i.description?.toLowerCase().includes('qa') ||
    i.http?.url?.includes('gorgias-qa') ||
    i.http?.url?.includes('/api/gorgias')
  );
  
  if (match) {
    console.log(`✅ Found integration: "${match.name}" (ID: ${match.id})`);
    console.log(`   URL: ${match.http?.url}`);
    return match.id;
  }
  
  console.log('Available HTTP integrations:');
  integrations.forEach(i => {
    console.log(`  - ID: ${i.id} | Name: ${i.name} | URL: ${i.http?.url}`);
  });
  
  return null;
}

async function listExistingWidgets() {
  console.log('\n🔍 Checking existing widgets...\n');
  const { status, data } = await gorgiasAPI('GET', '/widgets?limit=50');
  
  if (status !== 200) {
    console.error('❌ Failed to list widgets:', status, data);
    return [];
  }
  
  const widgets = data.data || data;
  console.log(`Found ${widgets.length} existing widget(s):`);
  widgets.forEach(w => {
    console.log(`  - ID: ${w.id} | Integration: ${w.integration_id} | Context: ${w.context} | Type: ${w.type}`);
  });
  return widgets;
}

async function createWidget(integrationId) {
  console.log(`\n📦 Creating QA Evaluator widget for integration ${integrationId}...\n`);
  
  const widgetTemplate = {
    type: "wrapper",
    widgets: [
      {
        type: "card",
        title: "📊 QA Evaluation",
        path: "",
        order: 0,
        meta: {
          displayCard: true,
          link: "",
          custom: {
            links: [
              {
                url: "https://gorgias-qa.vercel.app?ticket_id={{ticket_id}}",
                label: "Open Full Dashboard"
              }
            ]
          }
        },
        widgets: [
          {
            type: "text",
            title: "Status",
            path: "status",
            order: 0
          },
          {
            type: "text",
            title: "Score",
            path: "latest_score",
            order: 1
          },
          {
            type: "text",
            title: "Grade",
            path: "latest_grade",
            order: 2
          },
          {
            type: "text",
            title: "Agent",
            path: "latest_agent",
            order: 3
          },
          {
            type: "text",
            title: "Evaluator",
            path: "latest_evaluator",
            order: 4
          },
          {
            type: "text",
            title: "Date",
            path: "latest_date",
            order: 5
          },
          {
            type: "text",
            title: "Type",
            path: "latest_auto",
            order: 6
          },
          {
            type: "text",
            title: "Violation",
            path: "latest_violation",
            order: 7
          },
          {
            type: "card",
            title: "Category Scores",
            path: "",
            order: 8,
            meta: { displayCard: true },
            widgets: [
              {
                type: "text",
                title: "Soft Skills (20%)",
                path: "latest_soft_skills",
                order: 0
              },
              {
                type: "text",
                title: "Issue Understanding (30%)",
                path: "latest_issue_understanding",
                order: 1
              },
              {
                type: "text",
                title: "Product & Process (30%)",
                path: "latest_product_process",
                order: 2
              },
              {
                type: "text",
                title: "Tools Utilization (20%)",
                path: "latest_tools_utilization",
                order: 3
              }
            ]
          },
          {
            type: "text",
            title: "Feedback",
            path: "latest_feedback",
            order: 9
          },
          {
            type: "list",
            path: "evaluations",
            order: 10,
            meta: { limit: "5", orderBy: "" },
            widgets: [
              {
                type: "card",
                title: "{{agent}} — {{grade}} ({{score}})",
                meta: { displayCard: true },
                widgets: [
                  {
                    type: "text",
                    title: "Evaluator",
                    path: "evaluator",
                    order: 0
                  },
                  {
                    type: "text",
                    title: "Date",
                    path: "date",
                    order: 1
                  },
                  {
                    type: "text",
                    title: "Type",
                    path: "auto_graded",
                    order: 2
                  },
                  {
                    type: "text",
                    title: "Soft Skills",
                    path: "soft_skills",
                    order: 3
                  },
                  {
                    type: "text",
                    title: "Issue Understanding",
                    path: "issue_understanding",
                    order: 4
                  },
                  {
                    type: "text",
                    title: "Product & Process",
                    path: "product_process",
                    order: 5
                  },
                  {
                    type: "text",
                    title: "Tools Utilization",
                    path: "tools_utilization",
                    order: 6
                  },
                  {
                    type: "text",
                    title: "Feedback",
                    path: "feedback",
                    order: 7
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
  
  const { status, data } = await gorgiasAPI('POST', '/widgets', {
    context: 'ticket',
    type: 'http',
    integration_id: integrationId,
    template: widgetTemplate
  });
  
  if (status === 201 || status === 200) {
    console.log(`✅ Widget created successfully! ID: ${data.id}`);
    console.log('\n📋 Next steps:');
    console.log('   1. Open any ticket in Gorgias');
    console.log('   2. Click the ⚙️ cog icon at the top-right of the sidebar');
    console.log('   3. Drag "QA Evaluation" widget into your desired position');
    console.log('   4. Click "Save Changes"');
    console.log('\n   The widget will show evaluation data for graded tickets!');
    return data;
  } else {
    console.error('❌ Failed to create widget:', status, JSON.stringify(data, null, 2));
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Gorgias QA Evaluator Widget Setup');
  console.log('═══════════════════════════════════════\n');
  
  if (!GORGIAS_EMAIL || !GORGIAS_API_KEY) {
    console.error('❌ Missing GORGIAS_EMAIL or GORGIAS_API_KEY environment variables.');
    console.log('\nSet them before running:');
    console.log('  export GORGIAS_EMAIL=your-email');
    console.log('  export GORGIAS_API_KEY=your-api-key');
    process.exit(1);
  }
  
  // Step 1: Find integration
  const integrationId = await findIntegration();
  if (!integrationId) {
    console.error('\n❌ Could not find the QA integration. Please check the integration list above');
    console.log('   and update the search logic or pass the ID manually.');
    process.exit(1);
  }
  
  // Step 2: Check existing widgets
  const existing = await listExistingWidgets();
  const alreadyExists = existing.find(w => w.integration_id === integrationId);
  if (alreadyExists) {
    console.log(`\n⚠️  Widget already exists for this integration (ID: ${alreadyExists.id})`);
    console.log('   Deleting old widget and creating a new one...');
    await gorgiasAPI('DELETE', `/widgets/${alreadyExists.id}`);
    console.log('   ✅ Old widget deleted.');
  }
  
  // Step 3: Create widget
  await createWidget(integrationId);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
