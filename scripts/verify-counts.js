const http = require('http');

async function getElasticsearchCount() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:9200/analytics-events/_count', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.count);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

async function main() {
  try {
    const count = await getElasticsearchCount();
    console.log(`Elasticsearch document count: ${count}`);
  } catch (err) {
    console.error('Error connecting to Elasticsearch:', err.message);
    console.log('Make sure Elasticsearch is running on localhost:9200');
  }
}

main();
