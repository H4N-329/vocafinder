import {safeUrl,validSiteUrl,dateString,isoDate,numericBpm,effectiveBpm,bpmLabel,artistString,getLinks,videoDate,coverUrl,createCsv,matchesBpm,sortSongs,likelySameTitle} from './utils.js';
import {loadEdits,saveEdits,cleanEdit,validateImport,backupJson} from './storage.js';
import {findSongs,findArtists,fetchSong,findITunes,findNico,findYouTube} from './api.js';

const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;};
const appendLink=(parent,url,label)=>{const href=safeUrl(url);if(!href)return null;const a=el('a','',label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);return a;};
const row=(container,label,value)=>{container.append(el('dt','',label));const dd=el('dd');if(value instanceof Node)dd.append(value);else dd.textContent=String(value??'未登録');container.append(dd);return dd;};
const API_PAGE=20;
let edits=loadEdits();
let youtubeKey=''; // never persisted or committed to GitHub
const state={term:'',mode:'song',artist:null,artists:[],songs:[],total:0,offset:0,busy:false,reqVersion:0,controller:null,detailVersion:0};
const editFor=song=>edits[song.id]||{};
const currentMode=()=>document.querySelector('input[name="searchMode"]:checked').value;
const isCurrent=seq=>seq===state.reqVersion;
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);$('status').hidden=false;}
function updateLoading(value){state.busy=value;$('searchBtn').disabled=value;$('loadMore').disabled=value;}
function startRequest(){state.controller?.abort();state.controller=new AbortController();state.reqVersion++;return {seq:state.reqVersion,signal:state.controller.signal};}
function filters(){
  const lo=$('minBpm').value.trim(),hi=$('maxBpm').value.trim();
  return {min:lo===''?null:Number(lo),max:hi===''?null:Number(hi),onlyKnown:$('onlyKnown').checked,sort:$('sort').value};
}
function filteredSongs(){const f=filters();const filtered=state.songs.filter(s=>matchesBpm(s,editFor(s),f.min,f.max,f.onlyKnown));return f.sort==='original'?filtered:sortSongs(filtered,f.sort,edits);}
function addImage(parent,song,detail=false){const url=coverUrl(song);if(url){const img=el('img',detail?'detail-cover':'cover');img.alt=`${song.name||'楽曲'}の登録画像`;img.loading='lazy';img.referrerPolicy='no-referrer';img.src=url;img.onerror=()=>img.replaceWith(el('div',detail?'detail-fallback':'cover-fallback','♫'));parent.append(img);}else parent.append(el('div',detail?'detail-fallback':'cover-fallback','♫'));}
function displayCards(){const shown=filteredSongs(),container=$('results');container.replaceChildren();$('exportCsv').disabled=!shown.length;
  if(!state.songs.length){status(state.term?'検索結果はまだありません。':'検索したい曲名・アーティスト名を入力してください。');}
  else if(!shown.length)status('読み込み済みの曲に該当するものがありません。「もっと読み込む」か絞り込み条件の変更をお試しください。');
  else $('status').hidden=true;
  for(const song of shown){const edit=editFor(song),card=el('article','song-card');addImage(card,song);const body=el('div','card-body');body.append(el('h3','',song.name||'曲名不明'),el('div','artist-line',artistString(song)));const chips=el('div','chips');const b=effectiveBpm(song,edit);chips.append(el('span',`chip hot${b?.manual?' user':''}`,`BPM ${bpmLabel(b)}${b?.manual?' ✎':''}`),el('span','chip',`初公開 ${dateString(song.publishDate)}`));if(edit.streamingDate)chips.append(el('span','chip',`配信 ${dateString(edit.streamingDate)}`));body.append(chips);const actions=el('div','card-actions');const urls=getLinks(song,edit);appendLink(actions,urls.nico,'ニコニコ ↗');appendLink(actions,urls.youtube,'YouTube ↗');const more=el('button','','詳細・編集');more.type='button';more.addEventListener('click',()=>openDetail(song.id));actions.append(more);body.append(actions);card.append(body);container.append(card);}
  const filteredCount=shown.length;
  const suffix=state.total>state.songs.length?'（他の楽曲は未取得）':'';
  $('resultsSummary').textContent=`${state.total.toLocaleString()} 曲ヒット / ${state.songs.length.toLocaleString()} 曲を取得済み / ${filteredCount.toLocaleString()} 曲を表示 ${suffix}`;
  $('loadMore').hidden=state.songs.length>=state.total||state.songs.length>=500||!state.term;
  if(state.songs.length>=500&&state.total>500)$('scopeNote').textContent='※ APIへの負荷を避けるため、最大500曲まで読み込めます。並び替えとCSVは取得済みの曲が対象です。';
}
function resetSongs(){state.songs=[];state.offset=0;state.total=0;$('results').replaceChildren();$('loadMore').hidden=true;$('exportCsv').disabled=true;$('resultsSummary').textContent='検索中…';}
async function loadSongs(reset=false){if(state.busy&&!reset)return;
  const {seq,signal}=startRequest();updateLoading(true);
  try{const result=await findSongs({query:state.artist?'':state.term,artistId:state.artist?.id||null,offset:state.offset,limit:API_PAGE,signal});if(!isCurrent(seq))return;
    const items=Array.isArray(result.items)?result.items:[];
    const seen=new Set(state.songs.map(x=>x.id));for(const s of items){if(!seen.has(s.id)){state.songs.push(s);seen.add(s.id);}}
    state.offset+=items.length;state.total=Number.isFinite(Number(result.totalCount))?Number(result.totalCount):state.songs.length;
    if(items.length===0)state.total=state.songs.length;
    displayCards();
    if(!state.songs.length)status('該当する楽曲が見つかりませんでした。表記を変えて試してください。');
  }catch(e){if(!isCurrent(seq)||e.name==='AbortError')return;
    if(!state.songs.length){$('resultsSummary').textContent='データを取得できませんでした';status('VocaDBへの接続に失敗しました。時間を置いて再試行してください。('+e.message+')',true);}
    else status('続きの楽曲を取得できませんでした。再度「もっと読み込む」をお試しください。',true);
    console.error(e);
  }finally{if(isCurrent(seq))updateLoading(false);}
}
function drawArtists(){const cont=$('artistResults');cont.replaceChildren();for(const artist of state.artists){const btn=el('button',`artist-choice${state.artist?.id===artist.id?' selected':''}`,artist.name||'名前不明');btn.type='button';btn.addEventListener('click',()=>chooseArtist(artist));cont.append(btn);}if(!state.artists.length)cont.append(el('p','subtle','候補が見つかりませんでした。別の表記で検索してください。'));$('artistSection').hidden=false;}
async function chooseArtist(artist){state.artist=artist;resetSongs();drawArtists();$('resultsHeading').textContent=`${artist.name} の楽曲`;$('resultsSummary').textContent='楽曲を読み込み中…';status('選択したアーティストの楽曲を取得しています…');await loadSongs(true);}
async function search(){const term=$('query').value.trim();if(!term)return;
  state.term=term;state.mode=currentMode();state.artist=null;state.artists=[];resetSongs();$('artistSection').hidden=true;$('resultsHeading').textContent=`「${term}」の検索`;
  const query=new URL(window.location.href);query.searchParams.set('q',term);query.searchParams.set('mode',state.mode);history.replaceState(null,'',query);
  if(state.mode==='song'){status('VocaDBで曲名検索しています…');await loadSongs(true);return;}
  const {seq,signal}=startRequest();updateLoading(true);status('VocaDBでアーティスト名検索しています…');
  try{const data=await findArtists(term,signal);if(!isCurrent(seq))return;state.artists=Array.isArray(data.items)?data.items:[];drawArtists();$('resultsSummary').textContent=`アーティスト候補 ${state.artists.length} 件`;if(state.artists.length)status('上からアーティストを1人選択してください。');else status('アーティストが見つかりませんでした。');}
  catch(e){if(!isCurrent(seq)||e.name==='AbortError')return;status('アーティスト検索に失敗しました。通信状態をご確認ください。('+e.message+')',true);console.error(e);}
  finally{if(isCurrent(seq))updateLoading(false);}
}
function csvExport(){const songs=filteredSongs();if(!songs.length)return;
  const header=['曲名','アーティスト','VocaDB初公開日','動画投稿日（登録分）','配信日','配信日出典','BPM下限','BPM上限','BPM手動修正','ニコニコ動画URL','YouTube URL','配信URL','VocaDB URL','VocaDB ID'];
  const records=songs.map(s=>{const ed=editFor(s),b=effectiveBpm(s,ed),links=getLinks(s,ed);return [s.name,artistString(s),dateString(s.publishDate),dateString(videoDate(s,ed)),dateString(ed.streamingDate),ed.streamingSource||'',b?.min??'',b?.max??'',b?.manual?'はい':'いいえ',links.nico,links.youtube,ed.streamingUrl||ed.spotifyUrl||'',`https://vocadb.net/S/${s.id}`,s.id];});
  download('vocafinder_'+new Date().toISOString().slice(0,10)+'.csv',createCsv(records,header),'text/csv;charset=utf-8');
}
function download(filename,contents,mime){const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob);const anchor=el('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function formField(form,id,label,value='',type='text',placeholder='',wide=false){const div=el('div',`field${wide?' wide':''}`),lbl=el('label','',label),input=el('input');lbl.htmlFor=id;input.id=id;input.name=id;input.type=type;input.value=value??'';input.placeholder=placeholder;if(type==='number'){input.min='20';input.max='400';input.step='0.01';}div.append(lbl,input);form.append(div);return input;}
const setFeedback=(elem,text,isError=false)=>{elem.textContent=text;elem.style.color=isError?'#ffc7c8':'#b1efdf';};
function updateSaved(id,newEdit,feedback){const val=cleanEdit(newEdit);if(Object.keys(val).length)edits[id]=val;else delete edits[id];const ok=saveEdits(edits);if(feedback)setFeedback(feedback,ok?'保存しました。検索結果・CSVにも反映されます。':'このブラウザでは保存できません。ストレージの空きを確認してください。',!ok);displayCards();}
function externalSearchUrl(service,s){const q=[s.name,artistString(s)==='未登録'?'':artistString(s)].filter(Boolean).join(' ');return service==='nico'?`https://www.nicovideo.jp/search/${encodeURIComponent(q)}`:service==='youtube'?`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`:service==='spotify'?`https://open.spotify.com/search/${encodeURIComponent(q)}`:`https://music.apple.com/jp/search?term=${encodeURIComponent(q)}`;}
function createVideoLinks(song,edit){const box=el('div'),links=getLinks(song,edit);if(links.nico)appendLink(box,links.nico,'ニコニコ動画 ↗');if(links.youtube)appendLink(box,links.youtube,'YouTube ↗');if(!box.childNodes.length)box.textContent='未登録';return box;}
async function openDetail(id){const version=++state.detailVersion,dialog=$('detailDialog'),body=$('detailBody');body.replaceChildren(el('p','subtle','詳細を読み込み中…'));if(!dialog.open)dialog.showModal();
  let song=state.songs.find(x=>x.id===id);
  try{const detail=await fetchSong(id);if(version!==state.detailVersion||!dialog.open)return;song=detail;}
  catch(e){console.warn('VocaDB詳細APIが使えないため検索結果を表示',e);}
  if(version!==state.detailVersion||!dialog.open)return;
  if(!song){body.replaceChildren(el('p','subtle','楽曲の詳細が取得できませんでした。'));return;}
  renderDetail(song);
}
function renderDetail(song){const body=$('detailBody');body.replaceChildren();const ed=editFor(song);
  const hd=el('div','detail-header'),titleArea=el('div');addImage(hd,song,true);titleArea.append(el('h2','',song.name||'曲名不明'),el('div','subtle',artistString(song)));appendLink(titleArea,`https://vocadb.net/S/${song.id}`,'VocaDBで確認 ↗');hd.append(titleArea);body.append(hd);
  const meta=el('dl','detail-meta');row(meta,'VocaDB初公開日',dateString(song.publishDate));row(meta,'登録動画投稿日',dateString(videoDate(song,ed)));row(meta,'BPM',bpmLabel(effectiveBpm(song,ed)));row(meta,'配信日',ed.streamingDate?`${dateString(ed.streamingDate)}（${ed.streamingSource||'手動登録'}）`:'未登録・未確認');row(meta,'登録動画',createVideoLinks(song,ed));if(ed.streamingUrl||ed.spotifyUrl){const box=el('div');appendLink(box,ed.streamingUrl||ed.spotifyUrl,'配信ページ ↗');row(meta,'配信リンク',box);}
  body.append(el('hr'),meta,el('p','info-box','初公開日はVocaDBが持つ「楽曲が初めて公になった日」です。Spotify等の配信開始日とは異なる場合があります。登録画像も正式なジャケットとは限りません。'));
  body.append(el('hr'),el('h3','','手動登録・修正'));const editBox=el('div','edit-section');const form=el('form','edit-grid');form.id='songEditForm';const bpm=formField(form,'editBpm','BPM（20〜400、空欄でVocaDB値）',ed.bpm??'','number','例：128');const nico=formField(form,'editNico','ニコニコ動画URL',ed.nicoUrl||'','url','https://www.nicovideo.jp/watch/...',true);const youtube=formField(form,'editYoutube','YouTube URL',ed.youtubeUrl||'','url','https://www.youtube.com/watch?v=...',true);const release=formField(form,'editRelease','配信日（手動または候補から確認）',ed.streamingDate||'','date');const sourceField=el('div','field'),sourceLabel=el('label','','配信日出典'),source=el('select');sourceLabel.htmlFor='editSource';source.id='editSource';for(const text of ['その他 (手入力)','Apple Music / iTunes','Spotify (手入力)']){const opt=el('option','',text);opt.value=text;source.append(opt);}source.value=ed.streamingSource||'その他 (手入力)';sourceField.append(sourceLabel,source);form.append(sourceField);const dist=formField(form,'editStreamingUrl','配信ストアURL（Apple Music / Spotify）',ed.streamingUrl||ed.spotifyUrl||'','url','https://music.apple.com/... または https://open.spotify.com/...',true);editBox.append(form);const buttonBar=el('div','button-row');const save=el('button','primary','入力内容を保存');save.type='submit';save.setAttribute('form','songEditForm');const clear=el('button','outlined','この曲の手動登録を削除');clear.type='button';buttonBar.append(save,clear);editBox.append(buttonBar);const feedback=el('p','hint','手動修正はこのブラウザのみに保存されます。');feedback.setAttribute('role','status');editBox.append(feedback);body.append(editBox);
  form.addEventListener('submit',e=>{e.preventDefault();const entered={...editFor(song)};
    if(bpm.value.trim() && numericBpm(bpm.value)===null){setFeedback(feedback,'BPMは20〜400で入力してください。',true);return;}
    for(const [input,kind] of [[nico,'nico'],[youtube,'youtube']]){if(input.value.trim()&&!validSiteUrl(input.value.trim(),kind)){setFeedback(feedback,kind==='nico'?'ニコニコ動画のURLを入力してください。':'YouTubeのURLを入力してください。',true);return;}}
    if(dist.value.trim()&&!validSiteUrl(dist.value.trim(),'apple')&&!validSiteUrl(dist.value.trim(),'spotify')){setFeedback(feedback,'配信URLはApple MusicまたはSpotifyのURLを入力してください。',true);return;}
    if(release.value.trim()&&!isoDate(release.value)){setFeedback(feedback,'正しい配信日を入力してください。',true);return;}
    entered.bpm=bpm.value.trim();entered.nicoUrl=nico.value.trim();entered.youtubeUrl=youtube.value.trim();entered.streamingDate=release.value;entered.streamingSource=source.value;entered.streamingUrl=dist.value.trim();
    if(!entered.streamingDate)delete entered.streamingSource;
    if(!entered.nicoUrl)delete entered.nicoPublished;
    if(!entered.youtubeUrl)delete entered.youtubePublished;
    delete entered.spotifyUrl;
    updateSaved(song.id,entered,feedback);
  });
  clear.addEventListener('click',()=>{delete edits[song.id];const ok=saveEdits(edits);if(ok){setFeedback(feedback,'この曲の手動登録を削除しました。');renderDetail(song);displayCards();}else setFeedback(feedback,'削除後の保存に失敗しました。',true);});
  body.append(el('hr'),el('h3','','不足情報をほかのサイトで探す'));
  body.append(el('p','subtle','検索候補は別の曲・カバー・Remixの可能性があります。タイトルと投稿者を確認してから「採用」を押してください。'));
  const searchBtns=el('div','button-row'),candidate=el('div','candidate-list');
  for(const [kind,label] of [['nico','ニコニコ候補'],['youtube','YouTube候補'],['apple','配信日候補 (iTunes)']]){const b=el('button','outlined',label);b.type='button';b.addEventListener('click',()=>loadCandidates(kind,song,candidate,()=>renderDetail(song)));searchBtns.append(b);}
  body.append(searchBtns,candidate);
  const searchLinks=el('div','button-row');for(const [service,text] of [['nico','ニコニコで直接検索 ↗'],['youtube','YouTubeで直接検索 ↗'],['apple','Apple Musicで検索 ↗'],['spotify','Spotifyで検索 ↗']])appendLink(searchLinks,externalSearchUrl(service,song),text);body.append(el('p','hint','APIに接続できない場合は下記の外部検索を使い、見つけたURLを上のフォームに貼り付けてください。'),searchLinks);
}
async function loadCandidates(kind,song,container,rerender){container.replaceChildren(el('p','subtle','候補を取得中…'));
  let results;
  try{const term=[song.name,artistString(song)==='未登録'?'':artistString(song)].filter(Boolean).join(' ');
    if(kind==='nico')results=(await findNico(term)).map(v=>({title:v.title,url:`https://www.nicovideo.jp/watch/${encodeURIComponent(v.contentId)}`,date:(v.startTime||'').slice(0,10),source:'nico'}));
    if(kind==='youtube'){
      if(!youtubeKey){container.replaceChildren(el('p','hint','YouTube内の候補一覧にはAPIキーが必要です。「設定・バックアップ」で入力するか、下のYouTube外部検索を利用してください。'));return;}
      results=(await findYouTube(term,youtubeKey)).map(v=>({title:v.snippet?.title,url:`https://www.youtube.com/watch?v=${v.id?.videoId||''}`,date:(v.snippet?.publishedAt||'').slice(0,10),channel:v.snippet?.channelTitle,source:'youtube'}));
    }
    if(kind==='apple')results=(await findITunes(term)).filter(v=>v.kind==='song').map(v=>({title:v.trackName,url:v.trackViewUrl,date:(v.releaseDate||'').slice(0,10),channel:v.artistName,source:'apple'}));
    if(!$('detailDialog').open)return;
    container.replaceChildren();
    if(!results?.length){container.append(el('p','subtle','候補が見つかりませんでした。外部検索か手動登録をご利用ください。'));return;}
    for(const item of results){if(!safeUrl(item.url))continue;
      const wrapper=el('div','candidate-item'),info=el('div'),title=el('strong','',item.title||'タイトル不明');const extra=el('small','',`${item.channel||''}　${dateString(item.date)}${likelySameTitle(song.name,item.title)?'　● 曲名が近い候補':''}`);info.append(title,extra);appendLink(info,item.url,'元のページ ↗');const button=el('button','','この候補を採用');button.type='button';button.addEventListener('click',()=>{
        const current={...editFor(song)};
        if(item.source==='nico'&&validSiteUrl(item.url,'nico')){current.nicoUrl=item.url;if(isoDate(item.date))current.nicoPublished=item.date;}
        if(item.source==='youtube'&&validSiteUrl(item.url,'youtube')){current.youtubeUrl=item.url;if(isoDate(item.date))current.youtubePublished=item.date;}
        if(item.source==='apple'&&validSiteUrl(item.url,'apple')){current.streamingUrl=item.url;if(isoDate(item.date)){current.streamingDate=item.date;current.streamingSource='Apple Music / iTunes';}}
        updateSaved(song.id,current);rerender();
      });wrapper.append(info,button);container.append(wrapper);
    }
  }catch(e){console.warn(kind+'候補API',e);container.replaceChildren(el('p','hint',`候補取得に失敗しました（接続制限・CORS・APIキー・API停止など）。外部検索と手動登録は利用できます。詳細: ${e.message}`));}
}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();search();});
for(const btn of document.querySelectorAll('[data-sample]'))btn.addEventListener('click',()=>{
  $('query').value=btn.dataset.sample;const mode=btn.dataset.mode||'song';document.querySelector(`input[name="searchMode"][value="${mode}"]`).checked=true;search();
});
for(const input of document.querySelectorAll('input[name="searchMode"]'))input.addEventListener('change',()=>{$('query').placeholder=input.value==='artist'?'例：DECO*27':'例：ゴーストルール';});
$('loadMore').addEventListener('click',()=>loadSongs());
$('exportCsv').addEventListener('click',csvExport);
for(const elem of [$('minBpm'),$('maxBpm'),$('onlyKnown'),$('sort')])elem.addEventListener(elem.tagName==='SELECT'||elem.type==='checkbox'?'change':'input',displayCards);
$('resetFilters').addEventListener('click',()=>{$('minBpm').value='';$('maxBpm').value='';$('onlyKnown').checked=false;$('sort').value='original';displayCards();});
$('openSettings').addEventListener('click',()=>{$('settingsDialog').showModal();});
for(const btn of document.querySelectorAll('[data-close]'))btn.addEventListener('click',()=>$(btn.dataset.close).close());
$('youtubeKey').addEventListener('input',e=>youtubeKey=e.target.value.trim());
$('exportBackup').addEventListener('click',()=>download('vocafinder-backup-'+new Date().toISOString().slice(0,10)+'.json',backupJson(edits),'application/json;charset=utf-8'));
$('importBackup').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>1024*1024)throw new Error('ファイルが大きすぎます（上限1 MB）。');
    const imported=validateImport(JSON.parse(await file.text()));edits={...edits,...imported};if(!saveEdits(edits))throw new Error('ローカル保存に失敗しました。');
    $('settingsMessage').textContent=`${Object.keys(imported).length} 曲分のデータを取り込みました（同じ曲IDは取り込んだ値で上書き）。`;displayCards();
  }catch(err){$('settingsMessage').textContent='取り込みに失敗しました：'+err.message;}
  finally{e.target.value='';}
});
const params=new URLSearchParams(location.search);const q=(params.get('q')||'').slice(0,100);
if(q){$('query').value=q;if(params.get('mode')==='artist')document.querySelector('input[name="searchMode"][value="artist"]').checked=true;search();}
