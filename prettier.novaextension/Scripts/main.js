"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e={};class t extends Error{constructor(e,t){super(t),this.status=e}}function r(e){const t=function(e){const t=nova.workspace.config.get(e);switch(t){case"Enabled":case"Ignored":return!0;case"Disabled":case"Format on Save":return!1;case"Global Setting":return null;default:return t}}(e),r=nova.config.get(e);return null===t?r:t}var i={showError:function(e,t,r){let i=new NotificationRequest(e);i.title=nova.localize(t),i.body=nova.localize(r),i.actions=[nova.localize("OK")],nova.notifications.add(i).catch((e=>console.error(e,e.stack)))},showActionableError:function(e,t,r,i,n){let s=new NotificationRequest(e);s.title=nova.localize(t),s.body=nova.localize(r),s.actions=i.map((e=>nova.localize(e))),nova.notifications.add(s).then((e=>n(e.actionIdx))).catch((e=>console.error(e,e.stack)))},log:Object.fromEntries(["log","info","warn"].map((e=>[e,(...t)=>{(nova.inDevMode()||r("prettier.debug.logging"))&&console[e](...t)}]))),getConfigWithWorkspaceOverride:r,observeConfigWithWorkspaceOverride:function(e,t){let r=!1;function i(...e){r?t.apply(this,e):r=!0}nova.workspace.config.observe(e,i),nova.config.observe(e,i)},ProcessError:t,handleProcessResult:function(e,r,i){const n=[];e.onStderr((e=>{n.push(e)})),e.onDidExit((e=>{0!==e?r(new t(e,n.join("\n"))):i&&i()}))}};const{handleProcessResult:n,log:s}=i;function o(e,t,r){for(;;){const i=nova.path.join(e,t),n=nova.fs.stat(i);if(n){if(r(i,n))return{directory:e,path:i}}if("/"===e)break;e=nova.path.dirname(e)}return null}async function a(e,t){let r,i;const o=new Promise(((e,t)=>{r=e,i=t})),a=new Process("/usr/bin/env",{args:["npm","ls",t,"--parseable","--long","--depth","0"],cwd:e});return a.onStdout((e=>{if(!e||!e.trim())return;const[i,n,o,a]=e.trim().split(":");return n&&n.startsWith(`${t}@`)?i===nova.workspace.path?(s.info(`You seem to be working on ${t}! The extension doesn't work without ${t} built, so using the built-in ${t} instead.`),r(null)):void r({path:i,correctVersion:"INVALID"!==o&&"MAXDEPTH"!==a}):r(null)})),n(a,i,r),a.start(),o}var l=-1;function h(e,t,r,i){if(e===t)return e?[[0,e]]:[];if(null!=r){var n=function(e,t,r){var i="number"==typeof r?{index:r,length:0}:r.oldRange,n="number"==typeof r?null:r.newRange,s=e.length,o=t.length;if(0===i.length&&(null===n||0===n.length)){var a=i.index,l=e.slice(0,a),h=e.slice(a),c=n?n.index:null,g=a+o-s;if((null===c||c===g)&&!(g<0||g>o)){var p=t.slice(0,g);if((f=t.slice(g))===h){var u=Math.min(a,g);if((v=l.slice(0,u))===(w=p.slice(0,u)))return b(v,l.slice(u),p.slice(u),h)}}if(null===c||c===a){var d=a,f=(p=t.slice(0,d),t.slice(d));if(p===l){var m=Math.min(s-d,o-d);if((y=h.slice(h.length-m))===(S=f.slice(f.length-m)))return b(l,h.slice(0,h.length-m),f.slice(0,f.length-m),y)}}}if(i.length>0&&n&&0===n.length){var v=e.slice(0,i.index),y=e.slice(i.index+i.length);if(!(o<(u=v.length)+(m=y.length))){var w=t.slice(0,u),S=t.slice(o-m);if(v===w&&y===S)return b(v,e.slice(u,s-m),t.slice(u,o-m),y)}}return null}(e,t,r);if(n)return n}var s=g(e,t),o=e.substring(0,s);s=p(e=e.substring(s),t=t.substring(s));var a=e.substring(e.length-s),d=function(e,t){var r;if(!e)return[[1,t]];if(!t)return[[l,e]];var i=e.length>t.length?e:t,n=e.length>t.length?t:e,s=i.indexOf(n);if(-1!==s)return r=[[1,i.substring(0,s)],[0,n],[1,i.substring(s+n.length)]],e.length>t.length&&(r[0][0]=r[2][0]=l),r;if(1===n.length)return[[l,e],[1,t]];var o=function(e,t){var r=e.length>t.length?e:t,i=e.length>t.length?t:e;if(r.length<4||2*i.length<r.length)return null;function n(e,t,r){for(var i,n,s,o,a=e.substring(r,r+Math.floor(e.length/4)),l=-1,h="";-1!==(l=t.indexOf(a,l+1));){var c=g(e.substring(r),t.substring(l)),u=p(e.substring(0,r),t.substring(0,l));h.length<u+c&&(h=t.substring(l-u,l)+t.substring(l,l+c),i=e.substring(0,r-u),n=e.substring(r+c),s=t.substring(0,l-u),o=t.substring(l+c))}return 2*h.length>=e.length?[i,n,s,o,h]:null}var s,o,a,l,h,c=n(r,i,Math.ceil(r.length/4)),u=n(r,i,Math.ceil(r.length/2));if(!c&&!u)return null;s=u?c&&c[4].length>u[4].length?c:u:c;e.length>t.length?(o=s[0],a=s[1],l=s[2],h=s[3]):(l=s[0],h=s[1],o=s[2],a=s[3]);var d=s[4];return[o,a,l,h,d]}(e,t);if(o){var a=o[0],u=o[1],d=o[2],f=o[3],m=o[4],v=h(a,d),b=h(u,f);return v.concat([[0,m]],b)}return function(e,t){for(var r=e.length,i=t.length,n=Math.ceil((r+i)/2),s=n,o=2*n,a=new Array(o),h=new Array(o),g=0;g<o;g++)a[g]=-1,h[g]=-1;a[s+1]=0,h[s+1]=0;for(var p=r-i,u=p%2!=0,d=0,f=0,m=0,v=0,b=0;b<n;b++){for(var y=-b+d;y<=b-f;y+=2){for(var w=s+y,S=(k=y===-b||y!==b&&a[w-1]<a[w+1]?a[w+1]:a[w-1]+1)-y;k<r&&S<i&&e.charAt(k)===t.charAt(S);)k++,S++;if(a[w]=k,k>r)f+=2;else if(S>i)d+=2;else if(u){if((C=s+p-y)>=0&&C<o&&-1!==h[C])if(k>=(P=r-h[C]))return c(e,t,k,S)}}for(var x=-b+m;x<=b-v;x+=2){for(var P,C=s+x,E=(P=x===-b||x!==b&&h[C-1]<h[C+1]?h[C+1]:h[C-1]+1)-x;P<r&&E<i&&e.charAt(r-P-1)===t.charAt(i-E-1);)P++,E++;if(h[C]=P,P>r)v+=2;else if(E>i)m+=2;else if(!u){if((w=s+p-x)>=0&&w<o&&-1!==a[w]){var k;S=s+(k=a[w])-w;if(k>=(P=r-P))return c(e,t,k,S)}}}}return[[l,e],[1,t]]}(e,t)}(e=e.substring(0,e.length-s),t=t.substring(0,t.length-s));return o&&d.unshift([0,o]),a&&d.push([0,a]),u(d,i),d}function c(e,t,r,i){var n=e.substring(0,r),s=t.substring(0,i),o=e.substring(r),a=t.substring(i),l=h(n,s),c=h(o,a);return l.concat(c)}function g(e,t){if(!e||!t||e.charAt(0)!==t.charAt(0))return 0;for(var r=0,i=Math.min(e.length,t.length),n=i,s=0;r<n;)e.substring(s,n)==t.substring(s,n)?s=r=n:i=n,n=Math.floor((i-r)/2+r);return d(e.charCodeAt(n-1))&&n--,n}function p(e,t){if(!e||!t||e.slice(-1)!==t.slice(-1))return 0;for(var r=0,i=Math.min(e.length,t.length),n=i,s=0;r<n;)e.substring(e.length-n,e.length-s)==t.substring(t.length-n,t.length-s)?s=r=n:i=n,n=Math.floor((i-r)/2+r);return f(e.charCodeAt(e.length-n))&&n--,n}function u(e,t){e.push([0,""]);for(var r,i=0,n=0,s=0,o="",a="";i<e.length;)if(i<e.length-1&&!e[i][1])e.splice(i,1);else switch(e[i][0]){case 1:s++,a+=e[i][1],i++;break;case l:n++,o+=e[i][1],i++;break;case 0:var h=i-s-n-1;if(t){if(h>=0&&v(e[h][1])){var c=e[h][1].slice(-1);if(e[h][1]=e[h][1].slice(0,-1),o=c+o,a=c+a,!e[h][1]){e.splice(h,1),i--;var d=h-1;e[d]&&1===e[d][0]&&(s++,a=e[d][1]+a,d--),e[d]&&e[d][0]===l&&(n++,o=e[d][1]+o,d--),h=d}}if(m(e[i][1])){c=e[i][1].charAt(0);e[i][1]=e[i][1].slice(1),o+=c,a+=c}}if(i<e.length-1&&!e[i][1]){e.splice(i,1);break}if(o.length>0||a.length>0){o.length>0&&a.length>0&&(0!==(r=g(a,o))&&(h>=0?e[h][1]+=a.substring(0,r):(e.splice(0,0,[0,a.substring(0,r)]),i++),a=a.substring(r),o=o.substring(r)),0!==(r=p(a,o))&&(e[i][1]=a.substring(a.length-r)+e[i][1],a=a.substring(0,a.length-r),o=o.substring(0,o.length-r)));var f=s+n;0===o.length&&0===a.length?(e.splice(i-f,f),i-=f):0===o.length?(e.splice(i-f,f,[1,a]),i=i-f+1):0===a.length?(e.splice(i-f,f,[l,o]),i=i-f+1):(e.splice(i-f,f,[l,o],[1,a]),i=i-f+2)}0!==i&&0===e[i-1][0]?(e[i-1][1]+=e[i][1],e.splice(i,1)):i++,s=0,n=0,o="",a=""}""===e[e.length-1][1]&&e.pop();var b=!1;for(i=1;i<e.length-1;)0===e[i-1][0]&&0===e[i+1][0]&&(e[i][1].substring(e[i][1].length-e[i-1][1].length)===e[i-1][1]?(e[i][1]=e[i-1][1]+e[i][1].substring(0,e[i][1].length-e[i-1][1].length),e[i+1][1]=e[i-1][1]+e[i+1][1],e.splice(i-1,1),b=!0):e[i][1].substring(0,e[i+1][1].length)==e[i+1][1]&&(e[i-1][1]+=e[i+1][1],e[i][1]=e[i][1].substring(e[i+1][1].length)+e[i+1][1],e.splice(i+1,1),b=!0)),i++;b&&u(e,t)}function d(e){return e>=55296&&e<=56319}function f(e){return e>=56320&&e<=57343}function m(e){return f(e.charCodeAt(0))}function v(e){return d(e.charCodeAt(e.length-1))}function b(e,t,r,i){return v(e)||m(i)?null:function(e){for(var t=[],r=0;r<e.length;r++)e[r][1].length>0&&t.push(e[r]);return t}([[0,e],[l,t],[1,r],[0,i]])}function y(e,t,r){return h(e,t,r,!0)}y.INSERT=1,y.DELETE=l,y.EQUAL=0;const w=y,{showError:S,showActionableError:x,log:P,getConfigWithWorkspaceOverride:C}=i,E=String.fromCharCode(65533,65535,127124,127117,57348,127117).split(""),k=["arrowParens","bracketSameLine","bracketSpacing","embeddedLanguageFormatting","endOfLine","htmlWhitespaceSensitivity","insertPragma","jsxBracketSameLine","jsxSingleQuote","printWidth","proseWrap","quoteProps","requirePragma","semi","singleAttributePerLine","singleQuote","tabWidth","trailingComma","useTabs","vueIndentScriptAndStyle"],R=["phpVersion","singleQuote","trailingCommaPHP","braceStyle"],F=["xmlQuoteAttributes","xmlSelfClosingSpace","xmlSortAttributesByKey","xmlWhitespaceSensitivity"],I=["language","keywordCase","dataTypeCase","functionCase","identifierCase","logicalOperatorNewline","expressionWidth","linesBetweenQueries","denseOperators","newlineBeforeSemicolon","params","paramTypes"],j=["database","type"],D=["alignDirectives","alignUniversally","wrapParameters","continuationIndent"];var A={Formatter:class{constructor(){this.prettierServiceDidExit=this.prettierServiceDidExit.bind(this),this.prettierServiceStartDidFail=this.prettierServiceStartDidFail.bind(this),this.emitter=new Emitter,this.setupIsReadyPromise()}get defaultConfig(){return Object.fromEntries(k.map((e=>[e,C(`prettier.default-config.${e}`)])))}get phpConfig(){return Object.fromEntries(R.map((e=>[e,C(`prettier.plugins.prettier-plugin-php.${e}`)])))}get xmlConfig(){return Object.fromEntries(F.map((e=>[e,C(`prettier.plugins.prettier-plugin-xml.${e}`)])))}get sqlFormatterConfig(){return Object.fromEntries(I.map((e=>[e,C(`prettier.plugins.prettier-plugin-sql.sql-formatter.${e}`)])))}get nginxConfig(){return Object.fromEntries(D.map((e=>[e,C(`prettier.plugins.prettier-plugin-sql.sql-formatter.${e}`)])))}get nodeSqlParserConfig(){return Object.fromEntries(j.map((e=>[e,C(`prettier.plugins.prettier-plugin-nginx.${e}`)])))}get isReady(){return this._isReadyPromise?this._isReadyPromise:(this.showServiceNotRunningError(),!1)}async start(e){e&&(this.modulePath=e),this._isReadyPromise||this.setupIsReadyPromise(),this._isStoppedPromise&&await _isStoppedPromise,this.prettierService||(P.info("Starting Prettier service"),this.prettierService=new Process("/usr/bin/env",{args:["node",nova.path.join(nova.extension.path,"Scripts","prettier-service","prettier-service.js"),this.modulePath],stdio:"jsonrpc",cwd:nova.workspace.path}),this.prettierService.onDidExit(this.prettierServiceDidExit),this.prettierService.onNotify("didStart",(()=>{this._resolveIsReadyPromise(!0)})),this.prettierService.onNotify("startDidFail",this.prettierServiceStartDidFail),this.prettierService.start())}stop(){if(nova.notifications.cancel("prettier-not-running"),this._isReadyPromise&&this.prettierService&&!this._isStoppedPromise)return P.info("Stopping Prettier service"),this._isStoppedPromise=new Promise((e=>{this._resolveIsStoppedPromise=e})),this._resolveIsReadyPromise&&this._resolveIsReadyPromise(!1),this._isReadyPromise=null,this.prettierService.terminate(),this.prettierService=null,this._isStoppedPromise}setupIsReadyPromise(){this._isReadyPromise=new Promise((e=>{this._resolveIsReadyPromise=e}))}prettierServiceDidExit(e){if(this._resolveIsStoppedPromise&&(this._resolveIsStoppedPromise(),this._isStoppedPromise=null),this.prettierService){if(console.error(`Prettier service exited with code ${e}`),this._resolveIsReadyPromise&&this._resolveIsReadyPromise(!1),this._isReadyPromise=null,this.prettierService=null,this.prettierServiceCrashedRecently)return this.showServiceNotRunningError();this.prettierServiceCrashedRecently=!0,setTimeout((()=>this.prettierServiceCrashedRecently=!1),5e3),this.start()}}prettierServiceStartDidFail({parameters:e}){this._resolveIsReadyPromise(!1),x("prettier-not-running","Couldn't Load Prettier","Please ensure your Node.js installation is up to date. Additionally, check if the 'Prettier module' path is correctly set in your extension or project settings. For more details, refer to the error log in the Extension Console",["Project settings","Extension settings"],(e=>{switch(e){case 0:nova.workspace.openConfig();break;case 1:nova.openConfig()}})),console.error(`${e.name}: ${e.message}\n${e.stack}`)}showServiceNotRunningError(){x("prettier-not-running","Prettier Stopped Running","If this problem persists, please report the issue through the Extension Library.",["Restart Prettier"],(e=>{if(0===e)this.start()}))}async formatEditor(e,t,r){const{document:i}=e;nova.notifications.cancel("prettier-unsupported-syntax");const n=i.path||nova.workspace.path,s=await this.shouldApplyDefaultConfig(i,t,n);if(null===s)return[];P.info(`Formatting ${i.path}`);const o=new Range(0,i.length),a=e.getTextInRange(o),l=C("prettier.plugins.prettier-plugin-php.enabled"),h=C("prettier.plugins.prettier-plugin-sql.enabled"),c=C("prettier.plugins.prettier-plugin-xml.enabled"),g=C("prettier.plugins.prettier-plugin-nginx.enabled"),p=C("prettier.plugins.prettier-plugin-sql.formatter");let u=[];this.modulePath.includes(nova.extension.path)&&("php"===i.syntax&&l&&u.push(nova.path.join(nova.extension.path,"node_modules","@prettier","plugin-php","src","index.mjs")),"sql"===i.syntax&&h&&u.push(nova.path.join(nova.extension.path,"node_modules","prettier-plugin-sql","lib","index.cjs")),"xml"===i.syntax&&c&&u.push(nova.path.join(nova.extension.path,"node_modules","@prettier","plugin-xml","src","plugin.js")),"nginx"===i.syntax&&g&&u.push(nova.path.join(nova.extension.path,"node_modules","prettier-plugin-nginx","dist","index.js")));const d={parser:this.getParserForSyntax(i.syntax),...u.length>0?{plugins:u}:{},...i.path?{filepath:i.path}:{},...s?this.defaultConfig:{},...r?{rangeStart:e.selectedRange.start,rangeEnd:e.selectedRange.end}:{}};"php"===i.syntax&&Object.assign(d,this.phpConfig),"xml"===i.syntax&&Object.assign(d,this.xmlConfig),"sql"===i.syntax&&("sql-formatter"===p?Object.assign(d,this.sqlFormatterConfig):"node-sql-parser"===p&&Object.assign(d,this.nodeSqlParserConfig)),"nginx"===i.syntax&&Object.assign(d,this.nginxConfig),P.info("Prettier options:",JSON.stringify(d,null,2));const f=await this.prettierService.request("format",{original:a,pathForConfig:n,ignorePath:t&&this.getIgnorePath(n),options:d}),{formatted:m,error:v,ignored:b,missingParser:y}=f;return v?this.issuesFromPrettierError(v):b?(P.info(`Prettier is configured to ignore ${i.path}`),[]):y?(t||S("prettier-unsupported-syntax","Syntax Not Supported","Prettier doesn't include a parser for this file, and no installed plugin provides one."),P.info(`No parser for ${i.path}`),[]):m===a?(P.info(`No changes for ${i.path}`),[]):void await this.applyResult(e,a,m)}async shouldApplyDefaultConfig(e,t,r){if(t&&!0===C(`prettier.format-on-save.ignored-syntaxes.${e.syntax}`))return P.info(`Not formatting (${e.syntax} syntax ignored) ${e.path}`),null;let i=!1;if(e.isRemote){if(t&&C("prettier.format-on-save.ignore-remote"))return null}else if(i=await this.prettierService.request("hasConfig",{pathForConfig:r}),!i&&t&&C("prettier.format-on-save.ignore-without-config"))return null;return!i}getIgnorePath(e){const t=nova.workspace.path||nova.path.dirname(e);return nova.path.join(t,".prettierignore")}getParserForSyntax(e){switch(e){case"javascript":case"jsx":return"babel";case"tsx":return"typescript";case"flow":return"babel-flow";case"html+erb":return"erb";default:return e}}async applyResult(e,t,r){P.info(`Applying formatted changes to ${e.document.path}`);const[i,n]=this.diff(t,r,e.selectedRanges);if(t===e.getTextInRange(new Range(0,e.document.length)))return n?this.applyDiff(e,i,n):this.replace(e,r);P.info(`Document ${e.document.path} was changed while formatting`)}diff(e,t,r){const i=E.find((r=>!e.includes(r)&&!t.includes(r)));if(!i)return null;let n="",s=0;for(const t of r)n+=e.slice(s,t.start)+i+e.slice(t.start,t.end)+i,s=t.end;return n+=e.slice(s),[i,w(n,t)]}async applyDiff(e,t,r){const i=[];await e.edit((e=>{let n=0,s=0;r.push([w.EQUAL,""]);for(const[o,a]of r)if(o!==w.DELETE)o===w.EQUAL&&s?e.replace(new Range(n,n+s),""):o===w.INSERT&&e.replace(new Range(n,n+s),a),s=0,n+=a.length;else{s+=a.length;let e=-1;for(;e=a.indexOf(t,e+1),-1!==e;){const e=i[i.length-1];!e||e[1]?i[i.length]=[n]:e[1]=n,s-=t.length}}})),e.selectedRanges=i.map((e=>new Range(e[0],e[1])))}async replace(e,t){const{document:r}=e,i=e.selectedRange.end,n=new Range(0,r.length);await e.edit((e=>{e.replace(n,t)})),e.selectedRanges=[new Range(i,i)]}issuesFromPrettierError(e){if("string"!=typeof e.message)return[];if("UndefinedParserError"===e.name)throw e;let t=e.message.match(/\((\d+):(\d+)\)\n/m);if(!t&&(t=e.message.match(/^>\s*?(\d+)\s\|\s/m),t)){const r=e.message.match(/^\s+\|(\s+)\^+($|\n)/im);t[2]=r?r[1].length+1:0}if(!t)throw e;const r=new Issue;return r.message=e.stack?e.message:e.message.split(/\n\s*?at\s+/i)[0],r.severity=IssueSeverity.Error,r.line=t[1],r.column=t[2],[r]}}};const O=async function(){if(nova.workspace.path){try{const e=function(e,t){const r=o(e,"package.json",((e,r)=>{if(!r.isFile())return!1;const i=nova.fs.open(e,"r");try{const e=JSON.parse(i.read());if(e.dependencies&&e.dependencies[t]||e.devDependencies&&e.devDependencies[t])return!0}catch{}}));if(!r)return null;const i=o(r.directory,nova.path.join("node_modules",t),((e,t)=>t.isDirectory()||t.isSymbolicLink()));return i?i.path:null}(nova.workspace.path,"prettier");if(e)return s.info(`Loading project prettier (fs) at ${e}`),e}catch(e){s.warn("Error trying to find workspace Prettier using file system",e,e.stack)}try{const e=await a(nova.workspace.path,"prettier");if(e)return s.info(`Loading project prettier (npm) at ${e.path}`),e.path}catch(e){if(127===e.status)throw e;s.warn("Error trying to find workspace Prettier using npm",e,e.stack)}}try{const e=nova.path.join(nova.extension.path,"node_modules","prettier"),t=await a(nova.extension.path,"prettier");return t&&t.correctVersion||(s.info(`Installing / updating bundled Prettier at ${e}`),await async function(e){let t,r;const i=new Promise(((e,i)=>{t=e,r=i})),s=new Process("/usr/bin/env",{args:["npm","install","--only-prod"],cwd:e});return n(s,r,t),s.start(),i}(nova.extension.path)),s.info(`Loading bundled prettier at ${e}`),e}catch(e){if(127===e.status)throw e;s.warn("Error trying to find or install bundled Prettier",e)}},{showError:$,getConfigWithWorkspaceOverride:_,observeConfigWithWorkspaceOverride:W,log:L}=i,{Formatter:N}=A;class q{constructor(){this.didAddTextEditor=this.didAddTextEditor.bind(this),this.toggleFormatOnSave=this.toggleFormatOnSave.bind(this),this.modulePathDidChange=this.modulePathDidChange.bind(this),this.prettierConfigFileDidChange=this.prettierConfigFileDidChange.bind(this),this.editorWillSave=this.editorWillSave.bind(this),this.didInvokeFormatCommand=this.didInvokeFormatCommand.bind(this),this.didInvokeFormatSelectionCommand=this.didInvokeFormatSelectionCommand.bind(this),this.didInvokeSaveWithoutFormattingCommand=this.didInvokeSaveWithoutFormattingCommand.bind(this),this.saveListeners=new Map,this.ignoredEditors=new Set,this.issueCollection=new IssueCollection,this.formatter=new N}setupConfiguration(){nova.config.remove("prettier.use-compatibility-mode"),W("prettier.format-on-save",this.toggleFormatOnSave),W("prettier.module.path",this.modulePathDidChange)}start(){this.setupConfiguration(),nova.workspace.path&&(nova.fs.watch("**/.prettierrc*",this.prettierConfigFileDidChange),nova.fs.watch("**/package.json",this.prettierConfigFileDidChange)),nova.workspace.onDidAddTextEditor(this.didAddTextEditor),nova.commands.register("prettier.format",this.didInvokeFormatCommand),nova.commands.register("prettier.format-selection",this.didInvokeFormatSelectionCommand),nova.commands.register("prettier.save-without-formatting",this.didInvokeSaveWithoutFormattingCommand)}async startFormatter(){const e=_("prettier.module.path")||await O();L.info(`Loading prettier at ${e}`),await this.formatter.start(e).catch((()=>new Promise((e=>setTimeout(e,1e3))).then((()=>this.formatter.start(e)))))}toggleFormatOnSave(){this.enabled=_("prettier.format-on-save"),this.enabled?nova.workspace.textEditors.forEach(this.didAddTextEditor):(this.saveListeners.forEach((e=>e.dispose())),this.saveListeners.clear())}async prettierConfigFileDidChange(){await this.formatter.stop(),await this.formatter.start()}async modulePathDidChange(){try{await this.formatter.stop(),await this.startFormatter()}catch(e){return 127===e.status?$("prettier-resolution-error","Can't find npm and Prettier","Prettier couldn't be found because npm isn't available. Please make sure you have Node installed. If you've only installed Node through NVM, you'll need to change your shell configuration to work with Nova. See https://library.panic.com/nova/environment-variables/"):(console.error("Unable to start prettier service",e,e.stack),$("prettier-resolution-error","Unable to start Prettier","Please check the extension console for additional logs."))}}didAddTextEditor(e){this.enabled&&(this.saveListeners.has(e)||this.saveListeners.set(e,e.onWillSave(this.editorWillSave)))}async editorWillSave(e){await this.formatEditor(e,!0,!1)}async didInvokeFormatCommand(e){await this.formatEditor(e,!1,!1)}async didInvokeFormatSelectionCommand(e){await this.formatEditor(e,!1,!0)}async didInvokeSaveWithoutFormattingCommand(e){this.ignoredEditors.add(e),e.save().finally((()=>this.ignoredEditors.delete(e)))}async formatEditor(e,t,r){if(!this.ignoredEditors.has(e))try{if(!await this.formatter.isReady)return;const i=await this.formatter.formatEditor(e,t,r);this.issueCollection.set(e.document.uri,i)}catch(t){console.error(t,t.stack),$("prettier-format-error","Error while formatting",`"${t.message}" occurred while formatting ${e.document.path}. See the extension console for more info.`)}}}var T=e.activate=async function(){try{(new q).start()}catch(e){return console.error("Unable to set up prettier service",e,e.stack),$("prettier-resolution-error","Unable to start Prettier","Please check the extension console for additional logs.")}},M=e.deactivate=function(){};exports.activate=T,exports.deactivate=M,exports.default=e;
