/*05_매개변수와 리턴값.js*/
console.log(pow(5,3));
//선언된 매개변수보다 많은 매개변수로 호출할경우 : 뒷부분은 무시
console.log(pow(5,3,2,1,0));
//선언된 매개변수보다 적은 매개변수로 호출할경우 : 전달되지앟은 매개변수는 undefined
console.log(pow(5));
console.log(pow())
function pow(x,y){
    // x의 y승을 return
    console.log('함수 내의 x=${x},y=${y}');
    // result = x**y;
    result = 1;
    for(let cnt=1 ; cnt<=y ; cnt++)
        result *=x; // result = result*x;
    return result; //return이 없으면 undefined로
}