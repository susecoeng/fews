const months = ["JAN", "FEB", "MAR","APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

//FILTER JSON DATA
function sumArray(numArray) {
    return numArray.reduce(function (a, b) {
        return a + b;
    });
}
function getMin(numArray) {
    return Math.min.apply(Math, numArray);
}
function getMax(numArray) {
    return Math.max.apply(Math, numArray);
}

function filterData(dataArray, fieldName, fieldValue) {
    return $.grep(dataArray, function (a, i) { return a[fieldName] == fieldValue; });
}

function selectField(dataArray, field) {
    var grp = [];
    $.each(dataArray, function (i, v) {
        grp.push(v[field]);
    });
    return grp;
}

function groupby(dataArray, groupField) {
    var grp = {};
    $.each(dataArray, function (index, value) {
        var k = value[groupField];

        if (grp[k] == null) {
            grp[k] = [];
        }
        grp[k].push(value);
    });
    return grp;
}

function groupbySum(dataArray, groupField, sumField) {
    var grp = {};
    $.each(dataArray, function (index, value) {
        var k = value[groupField];

        if (grp[k] == null) {
            grp[k] = 0;
        }
        grp[k] += value[sumField];
    });
    return grp;
}

function groupbyHour(dataArray,dateField){
    var grp = {};
    $.each(dataArray, function (index, value) {
        var k = value[dateField].getHours();

        if (grp[k] == null) {
            grp[k] = [];
        }
        grp[k].push(value);
    });
    return grp;
}

function removeDuplicate(array) {
    return array.filter(function (elem, index, self) {
        return index === self.indexOf(elem);
    });
}

function convertTZ(date, tzString) {
    return new Date((typeof date === "string" ? new Date(date) : date).toLocaleString("en-US", {timeZone: tzString}));   
}

function formatDate(date,fString){
    var y=date.getFullYear();
    var m=date.getMonth();
    var mm=m+1;
    var d=date.getDate();
    var dd=d<10?'0'+d:d;

    if(mm<10)
        mm='0'+mm;

    fString=fString.replace('yy',y);
    fString=fString.replace('mm',mm);
    fString=fString.replace('MM',months[m]);
    fString=fString.replace('dd',dd);

    return fString;
    //return y+'-'+mm+'-'+d; 
}

function formatTime(date,fString){
    var h= date.getHours();
    var hh=h<10?'0'+h:h;
    var m= date.getMinutes();
    var mm=m<10?'0'+m:m;
    var s=date.getSeconds();

    var ss=s.toFixed(0);
    var S=s.toFixed(2);

    if(s<10){
        ss='0'+ss;
        S='0'+S;
    }
    fString=fString.replace('ss.ss',S);
    fString=fString.replace('hh',hh);
    fString=fString.replace('mm',mm);
    fString=fString.replace('ss',ss);

    return fString;
}