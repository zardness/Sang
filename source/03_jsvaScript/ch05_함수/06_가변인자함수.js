//가변 인자 함수 : 매개변수의 갯수에 따라 변하는 함수. 화살표 함수에서는 불가
//내장함수 Array()
var arr1 = [1,2,'삼'];
var arr2 = Array(1,2,'삼');
var arr3 = [ , , , ]; //방의 갯수가 3인 빈 배열
var arr4 = Array(3); //매개변수가 1개
var arr5 = [];
var arr6 =Array(); //매개변수가 0개
console.log(arr1);
console.log(arr2);
console.log(arr3[0],arr3[1],arr3[2]);
console.log(arr4[0],arr3[1],arr3[2]);
console.log(arr5);
console.log(arr6);