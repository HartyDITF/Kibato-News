import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";


const WEBHOOK = process.env.DISCORD_WEBHOOK;


const parser = new Parser({

customFields:{
item:[
["content:encoded","contentEncoded"],
["media:content","media"]
]
}

});


const feeds=[
"https://animecorner.me/feed/"
];


let sent=[];

let posterRequests=0;



if(fs.existsSync("sent.json")){

try{

sent =
JSON.parse(
fs.readFileSync("sent.json","utf8")
);

}catch{

sent=[];

}

}






function badNews(title){

const bad=[

"game",
"controller",
"figure",
"merch",
"podcast",
"interview",
"review",
"column",
"opinion",
"concert",
"live action",
"movie review"

];


return bad.some(x=>

title
.toLowerCase()
.includes(x)

);

}









async function translate(text){

if(!text)
return "";


try{


const clean =
text
.substring(0,4000);



const r =
await axios.get(

"https://translate.googleapis.com/translate_a/single",

{

params:{

client:"gtx",

sl:"en",

tl:"ru",

dt:"t",

q:clean

}

});


return r.data[0]
.map(x=>x[0])
.join("");


}catch{


return text;


}

}









function cleanText(text){


if(!text)
return "";



return text


.replace(/<script[\s\S]*?<\/script>/gi,"")

.replace(/<style[\s\S]*?<\/style>/gi,"")

.replace(/<[^>]*>/g,"")

.replace(/facebooktwitterpinterestlinkedintumblrredditwhatsapp/gi,"")

.replace(/Предыдущая запись.*$/gi,"")

.replace(/Следующая запись.*$/gi,"")

.replace(/Загрузка.*$/gi,"")

.replace(/Новости аниме/gi,"")

.replace(/&nbsp;/g," ")

.replace(/&amp;/g,"&")

.replace(/&quot;/g,'"')

.replace(/&#39;/g,"'")

.replace(/\s+/g," ")

.trim();


}











async function getArticleData(url,item){


let image=null;

let description="";



try{


if(item.media?.$?.url){

image=item.media.$.url;

}




if(item.contentEncoded){

description =
cleanText(item.contentEncoded)
.substring(0,1200);

}




const page =
await axios.get(

url,

{

headers:{

"User-Agent":
"Mozilla/5.0"

},

timeout:8000

});



const $ =
cheerio.load(
page.data
);




if(!image){

image =
$('meta[property="og:image"]')
.attr("content");

}



if(!image){

image =
$('meta[name="twitter:image"]')
.attr("content");

}




if(!image){

image =
$("article img")
.first()
.attr("src");

}




// Берём только абзацы статьи

if(!description){

description =

$("article p")
.map((i,el)=>
$(el).text()
)
.get()
.join(" ");

}



}catch(e){

console.log(
"Страница ошибка:",
e.message
);

}




return{

image,

description

};


}












async function getAnimePoster(title){


try{


let cleanTitle=

title

.replace(/Anime/gi,"")

.replace(/Film/gi,"")

.replace(/Trailer/gi,"")

.replace(/Reveals/gi,"")

.replace(/More Cast/gi,"")

.trim();



const r=

await axios.get(

"https://api.jikan.moe/v4/anime",

{

params:{

q:cleanTitle,

limit:1

},

timeout:5000

}

);



if(
r.data.data &&
r.data.data.length
){


console.log(

"Jikan:",
r.data.data[0].title

);


return r.data.data[0]
.images
.jpg
.large_image_url;


}


}catch(e){


console.log(

"Jikan ошибка:",

e.response?.status || e.message

);


}



return null;


}









async function sendDiscord(item,data){


const title =
await translate(
item.title
);


let description =
cleanText(
data.description
);



description =
description
.replace(/Новости аниме/gi,"")
.replace(/Anime Corner/gi,"")
.replace(/facebook/gi,"")
.replace(/twitter/gi,"")
.trim();



if(!description){

description =
"Новая аниме-новость";

}



description =
await translate(
description.substring(0,3900)
);





await axios.post(

WEBHOOK,

{

username:
"Kibato News",


embeds:[{


title:
"🌸 "+title,


url:item.link,


description,


color:16733695,



...(data.image?

{

image:{
url:data.image
}

}

:{}

),



footer:{

text:
"Kibato News"

},



timestamp:

new Date()



}],



components:[{

type:1,

components:[{

type:2,

style:5,

label:"📖 Читать",

url:item.link

}]

}]


});


}












async function main(){


let count=0;



for(const feed of feeds){


let rss;


try{


rss =
await parser.parseURL(feed);


}catch(e){


console.log(
"RSS ошибка:",
e.message
);


continue;


}






for(
const item of rss.items.slice(0,15)

){


try{



if(!item.link)
continue;



if(sent.includes(item.link))
continue;



if(badNews(item.title))
continue;





let data =

await getArticleData(

item.link,

item

);






if(
!data.image &&
posterRequests < 2
){



const poster=

await getAnimePoster(
item.title
);



if(poster){

data.image=poster;

}



posterRequests++;


}







await sendDiscord(

item,

data

);


sent.push(item.link);

fs.writeFileSync(
"sent.json",
JSON.stringify(sent.slice(-300),null,2)
);

sent.push(
item.link
);



count++;



console.log(

"Отправлено:",
item.title

);




await new Promise(

r=>setTimeout(r,2500)

);



}catch(e){


console.log(

"Ошибка новости:",

e.message

);


}



}



}




try{

fs.writeFileSync(
"sent.json",
JSON.stringify(
sent.slice(-300),
null,
2
)
);

console.log("sent.json сохранён");

}catch(e){

console.log(
"Ошибка сохранения sent.json:",
e.message
);

}



console.log(

"Всего отправлено:",
count

);


}





main().catch(e=>{

console.log(
"Критическая ошибка:",
e.message
);

});
