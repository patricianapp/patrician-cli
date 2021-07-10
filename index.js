const { spawn } = require('child_process');
const csvParse = require('csv-parse');

const output = [];
const parser = csvParse({delimiter: ','});

// Use the readable stream api
parser.on('readable', function(){
  let record;
  while (record = parser.read()) {
    output.push(record)
    // console.log(record);
  }
})
// Catch any error
parser.on('error', function(err){
  console.error(err.message)
})
// When we are done, test that the parsed output matched what expected
parser.on('end', function(){
  process.exit(0);
})

const cmd = spawn('beet', ['export', '-f', 'csv', '-i', 'title', 'artist:amon']);

cmd.stdout.on('data', (chunk) => {
  console.log(`writing chunk: \n\n${chunk}`);
  // parser.write(chunk);
})

cmd.on('close', () => {
  console.log('end');
  parser.end();
})

setInterval(() => {}, 1 << 30);
