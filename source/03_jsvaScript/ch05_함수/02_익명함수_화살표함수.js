let funVar = function(){    
    console.log('1. 일반함수호출');
};
funVar();
funVar = ()=>{
    console.log('2. 매개변수가 없거나 2개 이상인 화살표 함수 호출')
};
funVar();
funVar = i =>{
    console.log('3.매개변수가 하나있는 화살표 함수 호출');
    console.log('매개변수 i=' ,i);
};
funVar(10);
funVar = i => console.log('4. 매개변수가 하나고, 구현부가 한줄짜리 화살표 함수 호출',i);
funVar(10);
funVar =i => i*i;
console.log('5. 매개변수 하나짜리 return문 있는 화살표 함수호출:',funVar(5));
// funVar = function(i,j){return i+j;};
funVar =(i,j) => i+j;
console.log('6.', funVar(3,5));