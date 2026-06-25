const vm = require('vm');
const fs = require('fs');
const path = require('path');

const outdir = path.join(__dirname, 'dropped');
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir);

const makestub = (name = 'Stub') => new Proxy(() => makestub(name), {
  get: (target, prop) => (prop === Symbol.toPrimitive || prop === 'toString') ? () => name : makestub(`${name}.${String(prop)}`)
});

const wrap = (obj, name) => new Proxy(obj, {
  get(target, prop) {
    if (typeof prop !== 'string') return Reflect.get(target, prop);
    const key = Object.keys(target).find(item => item.toLowerCase() === prop.toLowerCase());
    return key ? (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) : makestub(`${name}.${prop}`);
  },
  set(target, prop, value) {
    const key = Object.keys(target).find(item => item.toLowerCase() === prop.toLowerCase()) || prop;
    target[key] = value;
    return true;
  }
});

const save = (filename, data) => {
  const name = path.basename(filename.replace(/\\/g, '/')) || `file_${Date.now()}`;
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(Array.isArray(data) ? data.join('') : String(data), 'utf8');
  fs.writeFileSync(path.join(outdir, name), buffer);
  console.log(`${name}`);
};

const fso = {
  fileexists: () => false,
  folderexists: () => true,
  getspecialfolder: () => 'C:\\Temp',
  buildpath: (pathstr, name) => `${pathstr}\\${name}`.replace(/\\\\/g, '\\'),
  createtextfile: (filename) => {
    let data = [];
    return wrap({ write: (str) => data.push(str), writeline: (str) => data.push(str + '\r\n'), close: () => save(filename, data) }, 'TextStream');
  }
};
fso.opentextfile = fso.createtextfile;

const adodb = () => {
  let buffer = [];
  return wrap({
    open() {},
    write(data) { buffer.push(data); },
    writetext(data) { buffer.push(data); },
    savetofile(filename) { save(filename, Buffer.concat(buffer.map(item => Buffer.isBuffer(item) ? item : Buffer.from(String(item))))); },
    close() {}
  }, 'ADODB.Stream');
};

const xmldom = {
  createelement: () => wrap({
    datatype: '',
    text: '',
    get nodetypedvalue() {
      const text = this.text.trim().replace(/[\r\n\s]/g, '');
      return Buffer.from(text, this.datatype.includes('base64') ? 'base64' : 'hex');
    }
  }, 'Element')
};

const shell = { expandenvironmentstrings: (str) => str.replace(/%[^%]+%/g, 'C:\\Temp') };

const wscript = {
  scriptname: path.basename(process.argv[2] || 'script.js'),
  scriptfullname: path.resolve(process.argv[2] || 'script.js'),
  createobject: (name) => context.ActiveXObject(name)
};

const xmlhttp = { open() {}, send() {}, responsebody: Buffer.alloc(0), responsetext: '' };

const context = {
  WScript: wrap(wscript, 'WScript'),
  ActiveXObject: function(name) {
    const lowername = name.toLowerCase();
    if (lowername.includes('filesystemobject')) return wrap(fso, 'FSO');
    if (lowername.includes('adodb.stream')) return adodb();
    if (lowername.includes('xmldom') || lowername.includes('domdocument')) return wrap(xmldom, 'XMLDOM');
    if (lowername.includes('wscript.shell')) return wrap(shell, 'Shell');
    if (lowername.includes('xmlhttp')) return wrap(xmlhttp, 'XMLHTTP');
    return makestub(name);
  },
  XMLHttpRequest: () => wrap(xmlhttp, 'XMLHTTP'),
  setTimeout, clearTimeout
};

if (!process.argv[2]) {
  console.error("supply the file");
  process.exit(1);
}

vm.createContext(context);
try {
  vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), context);
} catch (e) {
  console.error(`end ${e.message}`);
}
