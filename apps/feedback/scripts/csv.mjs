// Strict RFC-4180-style parser: UTF-8 BOM, CRLF/LF, quoted commas/newlines.
// Never include source values in errors: inputs can be confidential bearer stock.
export function parseCSV(source){
 if(typeof source!=='string'||source.length>20*1024*1024)throw Error('CSV missing or too large');
 source=source.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('Malformed CSV quote');quoted=true;continue;}
  if(c===','||c==='\n'||c==='\r'){
   row.push(cell);cell='';closed=false;
   if(c!==','){if(c==='\r'&&source[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[];}continue;
  }
  if(closed)throw Error('Unexpected text after quoted cell');cell+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length||closed){row.push(cell);if(row.some(Boolean))rows.push(row);}
 if(!rows.length)throw Error('Empty CSV');const headers=rows.shift();
 if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw Error('Missing or duplicate CSV headers');
 if(rows.some(x=>x.length!==headers.length))throw Error('CSV column count mismatch');
 return {headers,rows:rows.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,cells[i]])))};
}
