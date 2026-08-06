/*매개변수가 없으면 -999를 리턴하고 매개변수가 1개 이상이면 매개변수들의 
누적합을 리턴하는 가변인자 함수 sumAll()을 작성한 스크립트 파일(sumAll.js)을 이용하시오.*/
function sumAll(){
    // if (arguments.length == 0){
    //     return -999
    // }
    // let sum = 0;
    // for(let i=0; i<arguments.length; i++){
    //     sum += arguments[i];
    // }
    // return sum;
    let result = 0;
    if (arguments.length>0){
        // for(let idx=0 ; idx<arguments.length;idx++){
        //     result += arguments[idx];
        //     //for
        // for(let idx in arguments){
        //     result += arguments[idx];
        // }
            for(let data of arguments){
                result += data;
            }  
        
        }else{
        result=-999
    }
    return result;

}sumAll();
console.log(sumAll());
console.log(sumAll(1,3));
console.log(sumAll(1,3,10,20));