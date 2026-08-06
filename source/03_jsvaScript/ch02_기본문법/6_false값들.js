// false로 해석되는값 : 0 NaN, undifined, null, '' / [],'  '는 true
var i;
console.log(Boolean(i));
console.log(Boolean(0));
console.log(Boolean(NaN));
console.log(Boolean(null));
console.log(Boolean(''));
console.log(Boolean([]));
console.log(Boolean(' '));
