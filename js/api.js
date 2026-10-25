const ROOT='https://vocadb.net/api';
const FIELDS='Artists,MainPicture,ThumbUrl,PVs,Bpm,WebLinks,Albums';
const memo=new Map();
const cachedFetch=async (url,signal)=>{
  const key=url.toString(), cached=memo.get(key);
  if(cached&&Date.now()-cached.time<5*60_000)return cached.data;
  const r=await fetch(key,{signal,headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const data=await r.json();
  if(memo.size>60)memo.delete(memo.keys().next().value);
  memo.set(key,{time:Date.now(),data});return data;
};
export const findSongs=({query='',artistId=null,offset=0,limit=20,sort='None',signal})=>{
  const u=new URL(ROOT+'/songs');
  if(query)u.searchParams.set('query',query);
  if(artistId)u.searchParams.set('artistId',String(artistId));
  u.searchParams.set('start',String(offset));
  u.searchParams.set('maxResults',String(limit));
  u.searchParams.set('getTotalCount','true');
  u.searchParams.set('nameMatchMode','Partial');
  u.searchParams.set('fields',FIELDS);
  u.searchParams.set('lang','Japanese');
  if(sort!=='None')u.searchParams.set('sort',sort);
  return cachedFetch(u,signal);
};
export const findArtists=(term,signal)=>{
  const u=new URL(ROOT+'/artists');
  u.searchParams.set('query',term);
  u.searchParams.set('nameMatchMode','Partial');
  u.searchParams.set('maxResults','15');
  u.searchParams.set('lang','Japanese');
  return cachedFetch(u,signal);
};
export const fetchSong=(id,signal)=>{
  const u=new URL(ROOT+'/songs/'+encodeURIComponent(id));u.searchParams.set('fields',FIELDS);u.searchParams.set('lang','Japanese');return cachedFetch(u,signal);
};
export const findITunes=async(term,signal)=>{
  const u=new URL('https://itunes.apple.com/search');
  u.searchParams.set('term',term);u.searchParams.set('entity','song');u.searchParams.set('country','jp');u.searchParams.set('limit','12');
  const r=await fetch(u,{signal});if(!r.ok)throw new Error('Apple API HTTP '+r.status);
  const data=await r.json();return data.results||[];
};
export const findNico=async(term,signal)=>{
  const u=new URL('https://api.search.nicovideo.jp/api/v2/snapshot/video/contents/search');
  u.searchParams.set('q',term);u.searchParams.set('targets','title');u.searchParams.set('_fields','contentId,title,startTime');
  u.searchParams.set('_sort','-startTime');u.searchParams.set('_limit','10');u.searchParams.set('_context','VocaFinderV2');
  const r=await fetch(u,{signal});if(!r.ok)throw new Error('Nico HTTP '+r.status);
  const data=await r.json();return data.data||[];
};
export const findYouTube=async(term,key,signal)=>{
  const u=new URL('https://www.googleapis.com/youtube/v3/search');
  u.searchParams.set('part','snippet');u.searchParams.set('q',term);u.searchParams.set('type','video');
  u.searchParams.set('maxResults','10');u.searchParams.set('key',key);
  const r=await fetch(u,{signal});if(!r.ok)throw new Error('YouTube API HTTP '+r.status);
  const data=await r.json();return data.items||[];
};
