var cnt = 0;
var startTime = new Date().getTime(); //1970.1.1부터 현재까지의 밀리세컨(1000밀리세컨=1초)
//console.log(startTime);
while(new Date().getTime()<=startTime+1000){
    cnt++;//1증가
}
console.log('1초동안 while문 수행 횃수:' + cnt);
cnt = 0
startTime = new Date().getTime();
do{
    cnt++
}while(new Date().getTime()<=startTime+1000);
console.log('1초동안 do-while문 수행횃수:' + cnt)