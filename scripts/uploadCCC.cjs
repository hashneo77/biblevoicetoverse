const https = require('https')
const fs = require('fs')
const { execSync } = require('child_process')

const token = execSync('gcloud auth print-access-token --project=biblevoicetoverse').toString().trim()
const data = fs.readFileSync('catechism_firebase.json')

const url = new URL('https://biblevoicetoverse-default-rtdb.firebaseio.com/ccc.json')
url.searchParams.set('access_token', token)

const req = https.request(url.toString(), {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
}, res => {
  let body = ''
  res.on('data', d => body += d)
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('Upload successful! Keys written:', JSON.parse(body) ? 'ok' : 'check')
    } else {
      console.error('Error', res.statusCode, body.slice(0, 300))
    }
  })
})

req.on('error', e => console.error('Request error:', e.message))
req.write(data)
req.end()
console.log('Uploading 1.2 MB CCC data to Firebase...')
