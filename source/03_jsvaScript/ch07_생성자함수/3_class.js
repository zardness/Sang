// ECMA script6이상을 지원하는 브라우저에서만 가능
// 확인:caniuse.com에서 ES6 으로 지원 브라우저 확인가능
class Student{
    constructor(name,kor,mat,eng){//생성자 이름은 무조건 constructor
        this.name = name;
        this.kor = kor;
        this.mat = mat;
        this.eng = eng;
        }
        getSum(){
            return this.kor + this.mat + this.eng;
        };
        getAvg(){
            return Math.round(this.getSum()/3);
        };
        toString(){
            return'name :' + this.name +
                  'kor :' + this.kor +
                  'mat :' + this.mat +
                  'eng :' + this.eng +
                  '합계 :' + this.getSum() +
                  '평균 :' + this.getAvg(); 
        };    
};
    let hong = new Student('홍길동',99,100,86);
    document.write(hong) //toString();//자동호출
    console.log(hong);
    console.log(`${hong}`);//템플릿 리터럴에서는 toString()자동호출