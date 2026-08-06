/*array함수 : 가변인자함수(함수표현식)
 *매개변수 0개 : length가 0인 배열 생성하여 return
 *매개변수 1개 : length가 매개변수인만큼 크기의 뱌열을 return
 *매개변수 2개이상 : 매개변수로 배열을 생성 return */
function array(){//aruments : 매개변수 내용이 들어옴/arguments.length:매개변수갯수
    // console.log(arguments, arguments.length);
    let result = [];
    if(arguments.length==1){
        //result를 arguments[0]만큼 크기의 빈 배열
        for(let cnt=1 ; cnt<=arguments[0]; cnt++){
            result.push(undefined);
        }
    }else if(arguments.length>=2){
        //result를 arguments의 내용으로 만들기
        // for(let idx=0 ; idx<arguments.length; idx++){
        //     result.push(arguments[idx]);
        // }//for
        for(var data of arguments){
            result.push(data);
        }
    }//if
    return result;
}// array
var arr1 = [1,2,'삼'];
var arr2 = array(1,2,'삼');
var arr3 = [ , , , ]; //방의 갯수가 3인 빈 배열
var arr4 = array(3); //매개변수가 1개
var arr5 = [];
var arr6 =array(); //매개변수가 0개

console.log(arr2);
console.log(arr3[0],arr3[1],arr3[2]);
console.log(arr4[0],arr3[1],arr3[2]);
console.log(arr5);
console.log(arr6);