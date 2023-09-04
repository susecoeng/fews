var map, overlay, extent, stn_layer;
var stationFeatures = [];
var activeFeature;
var stnData = {};
var fcastData = {};
var tzone = 'Africa/Blantyre'; //'Asia/Kathmandu';
var liveInterval = 10000;
// var flashFeatures=[];
var flashKeys = [];
var siren;
var fdateFlag = false;

var st1 = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: "#2e7bbd",
      width: 1
    }),
    fill: new ol.style.Fill({
      color: '#4e99da' //"#ff9573"
    })
  })
});

var alertStyle = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: "#f1770f",
      width: 1
    }),
    fill: new ol.style.Fill({
      color: "#e8b72b"
    })
  })
});

var warningStyle = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: "#f1770f",
      width: 1
    }),
    fill: new ol.style.Fill({
      color: "#ff0000" //"#1ba6cf"
    })
  })
});


function startMain() {
  initControls();
  initMap();
}

function initControls() {
  //UI controls
  loadDistrict();
  loadStationList();

  actionHandle();

  siren = document.getElementById("siren");

}

function loadDistrict() {
  var csrftoken = $('[name=csrfmiddlewaretoken]').val();
  // $.post('/getDistricts/',function(dist){
  //   var d=dist;
  // })

  $.ajax({
    url: '/getDistricts/',
    type: 'post',
    data: {},
    headers: {
      'X-CSRFToken': csrftoken
    },
    dataType: 'json',
    success: function (data) {

      $('#selDistrict').empty();
      var txt = '<option value="all">All</option>';
      $.each(data, function (i, d) {
        txt += '<option value="' + d.pk + '">' + d.fields.name + '</option>';
      })
      $('#selDistrict').append(txt);
    }
  });

}

function loadStationList() {

  var csrftoken = $('[name=csrfmiddlewaretoken]').val();
  $.ajax({
    url: '/getStations/',
    type: 'post',
    data: {},
    headers: {
      'X-CSRFToken': csrftoken
    },
    dataType: 'json',
    success: function (data) {

      var st_intvl = setInterval(function () {
        if (map != null) {
          clearInterval(st_intvl);

          //plot station in map
          loadStationPoints(data)

        }

      }, 100)

    },
    complete: function (data) {
      if (data.status != 200)
        return;

      liveUpdate();
      setInterval(liveUpdate, liveInterval);


    }
  });

}


function liveUpdate() {
  var csrftoken = $('[name=csrfmiddlewaretoken]').val();
  var tday = formatDate(new Date(), 'yy-mm-dd'); //'2021-01-28';//

  // console.log(new Date());

  $.ajax({
    url: '/getLatestData/?fromDate=' + tday,
    type: 'post',
    data: {},
    headers: {
      'X-CSRFToken': csrftoken
    },
    dataType: 'json',
    success: function (data) {

      $.each(data, function (i, v) {
        // data[i].receivedDate= new Date(data[i].receivedDate)
        data[i].receivedDate = convertTZ(v.receivedDate, tzone);
      });

      if (data.length > 0) {
        $('#data-title').text(formatDate(data[0].receivedDate, 'yy-MM-dd') + ', ' + formatTime(data[0].receivedDate, 'hh:mm'))
        data = groupby(data, 'stnid');
      } else {
        var dd = convertTZ(new Date(), tzone);
        $('#data-title').text(formatDate(dd, 'yy-MM-dd') + ', ' + formatTime(dd, 'hh:mm'))
      }


      var ivl = setInterval(function () {
        if (stationFeatures.length > 0)
          clearInterval(ivl);

        var sctop = $('.data-listview').scrollTop();
        $('.data-listview').empty();

        //remove flash from features & reset
        $.each(flashKeys, function (i, k) {
          ol.Observable.unByKey(k);
          //k.listener=null;
        })
        flashKeys = [];

        $.each(stationFeatures, function (i, s) {
          var id = s.get('id');


          // var dv = data[id] == null ? 'N/A' : (data[id][0].isSpike == 1 ? 'N/A' : data[id][0].depthValue); // || data[id][0].depthValue == -999 
          // var rf = data[id] == null ? 'N/A' : data[id][0].rainfall;

          var dv = 'N/A';
          var rf = 'N/A';
          if (data[id] != null) {

            rf = data[id][0].rainfall;

            if (data[id][0].isSpike == 0 && data[id][0].depthValue != -999) {
              dv = data[id][0].depthValue;
            }

          }




          var dcolor = "";
          var active = "";
          if (activeFeature && id == activeFeature.get('id'))
            active = 'active';

          if (dv >= s.get('first_warning') && dv < s.get('second_warning')) {
            dcolor = 'style="color:#e8b72b"';
            s.setStyle(alertStyle);
          } else if (dv >= s.get('second_warning')) {
            dcolor = 'style="color:#ff0000;"';
            s.setStyle(warningStyle);
            flash(s);
            tileLayer.getSource().changed();

            if ($('#activateSiren').is(':checked'))
              siren.play();
          } else {
            s.setStyle(st1);
          }

          stn_layer.getSource().changed();

          var txt = '<div id="' + id + '" class="listitem ' + active + '">';
          txt += '<div>' + s.get('name') + '</div>' //+s.fields.water_station+' - '

          var u = dv == 'N/A' ? '' : ' cm';
          txt += '<div class="itemdata" ' + dcolor + '><i class="fas fa-water"></i><span> ' + dv + u + '</span></div>'
          u = rf == 'N/A' ? '' : ' mm';
          txt += '<div class="itemdata"><i class="fas fa-cloud-rain"></i><span> ' + rf + u + '</span></div>'
          txt += '</div>'

          if (dv >= s.get('second_warning'))
            $('.data-listview').prepend(txt);
          else
            $('.data-listview').append(txt);


          // update the chart
          var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
          if ($('#dChart').is(":visible") && cdate == tday && id == $('#stnid-chart').val()) {

            if (stnData[id].data[tday] != null) {
              var lstindex = stnData[id].data[tday].length - 1;
              if (stnData[id].data[tday][lstindex].receivedDate.getTime() != data[id][0].receivedDate.getTime())
                stnData[id].data[tday].push(data[id][0]);
            } else
              stnData[id].data[tday] = data[id];

            showChart(s, tday);
          }

        })

        $('.data-listview').scrollTop(sctop);

      }, 100)

    },
    complete: function (data) {
      if (data.status != 200)
        return;


    }
  })
}

function actionHandle() {
  $(document).on('click', '.data-listview .listitem', function () {

    var stnid = $(this).attr('id');

    // if(activeFeature && activeFeature.get('id') == stnid)
    //   return;

    // $('#dChart').hide();

    $('.data-listview .listitem.active').removeClass('active');
    $(this).addClass('active');


    //show overlay on map
    activeFeature = findFeature(stnid);
    if (activeFeature != null)
      showOverlay(activeFeature);

    if ($('#dChart').is(":visible")) {
      var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
      showChart(activeFeature, cdate);
    }



  })

  //change on water level date
  $('#wlevelDate').on('changeDate', function (e) {
    var cDate = formatDate(e.date, 'yy-mm-dd');
    showChart(activeFeature, cDate);
  });

  //switch all/hourly water level
  $('.wlevel-option').click(function () {
    if ($(this).text() == 'All') {
      $(this).next().removeClass('active');
      $(this).addClass('active');

    } else {
      $(this).prev().removeClass('active');
      $(this).addClass('active');

    }

    var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
    drawWaterChart(activeFeature.get('id'), cdate);
  })

  //switch all/hourly rainfall
  $('.rain-option').click(function () {
    if ($(this).text() == 'All') {
      $(this).next().removeClass('active');
      $(this).addClass('active');

    } else {
      $(this).prev().removeClass('active');
      $(this).addClass('active');

    }

    var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
    drawRainfallChart(activeFeature.get('id'), cdate);
  })

  //switch all/hourly discharge
  $('.discharge-option').click(function () {
    if ($(this).text() == 'All') {
      $(this).next().removeClass('active');
      $(this).addClass('active');

    } else {
      $(this).prev().removeClass('active');
      $(this).addClass('active');

    }

    var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
    drawDischargeChart(activeFeature.get('id'), cdate);
  })

  $('#p_rain-tab').click(function () {
    $('#wlevelDate').parent().insertBefore($('#rainChart'));
    $('#rainChart').empty();
    setTimeout(function () {
      var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
      drawRainfallChart(activeFeature.get('id'), cdate);
    }, 200);
  })

  $('#p_wlevel-tab').click(function () {
    $('#wlevelDate').parent().insertBefore($('#wlevelChart'));
    $('#wlevelChart').empty();
    setTimeout(function () {
      var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
      drawWaterChart(activeFeature.get('id'), cdate);
    }, 200);
  })

  $('#p_discharge-tab').click(function () {
    $('#wlevelDate').parent().insertBefore($('#dischargeChart'));
    $('#dischargeChart').empty();

    setTimeout(function () {
      var cdate = formatDate($('#wlevelDate').datepicker('getDate'), 'yy-mm-dd');
      drawDischargeChart(activeFeature.get('id'), cdate);
    }, 200);

  })


  //change on water level date
  $('#fcastDate').on('changeDate', function (e) {
    if (fdateFlag == false) {
      updateForecast();
    }

  });

  $('#p_streamflow-tab').click(function () {
    var reachid = activeFeature.get('reach_id');
    var region = reach_to_region(reachid);

    $.ajax({
      url: 'https://geoglows.ecmwf.int/api/AvailableDates/?region=' + region,
      type: 'get',
      data: {},
      // dataType: 'json',
      success: function (data) {
        var d = data.available_dates.sort();
        // var dateString = "2010-08-09 01:02:03";
        var reggie = /(\d{4})(\d{2})(\d{2})/;
        var dateArray = reggie.exec(d[0]);
        var stdate = new Date(
          (+dateArray[1]),
          (+dateArray[2]) - 1, // Careful, month starts at 0!
          (+dateArray[3])
        );

        dateArray = reggie.exec(d[d.length - 1]);
        var enddate = new Date(
          (+dateArray[1]),
          (+dateArray[2]) - 1, // Careful, month starts at 0!
          (+dateArray[3])
        );

        $('#fcastDate').datepicker('setStartDate', stdate);
        $('#fcastDate').datepicker('setEndDate', enddate);
        // fdateFlag=true;
        $('#fcastDate').datepicker('setDate', enddate);

      },
      complete: function (data) {
        var m = data;
      }
    });

    // updateForecast();
  })

  function DateUpdated(e, flag) {
    if (typeof flag === "undefined") {
      // call when user manually picked
      updateForecast();
    }
  }

  function reach_to_region(reach_id) {
    var reg = {
      //  IMPROPERLY NUMBERED REGIONS
      'australia-geoglows': 300000,
      'middle_east-geoglows': 700000,
      'central_america-geoglows': 1000000,
      //  CORRECTLY NUMBERED REGIONS
      'islands-geoglows': 2000000,
      'japan-geoglows': 4000000,
      'east_asia-geoglows': 5000000,
      'south_asia-geoglows': 6000000,
      'africa-geoglows': 8000000,
      'central_asia-geoglows': 9000000,
      'south_america-geoglows': 10000000,
      'west_asia-geoglows': 11000000,
      'europe-geoglows': 13000000,
      'north_america-geoglows': 14000000
    }

    var r = ''
    $.each(reg, function (k, v) {
      if (reach_id < v) {
        r = k;
        return false;
      }

    })

    return r;
  }

  function updateForecast() {

    var reachid = activeFeature.get('reach_id');
    var _sname = activeFeature.get('name');

    // var cdate = new Date($('#fcastDate').datepicker('getDate'));
    // https://geoglows.ecmwf.int/api/AvailableDates/?region=africa-geoglows

    var cdate = formatDate($('#fcastDate').datepicker('getDate'), 'yymmdd');

    if (fcastData != null && fcastData.comid == reachid && fcastData.cdate == cdate) {
      setTimeout(function () {
        forecastChart(_sname, fcastData);
        $('#fcast-loading').hide();
      }, 200);
    } else {
      $('#streamflowChart').empty();
      $('#fcast-loading').show();


      $.get('https://geoglows.ecmwf.int/api/ForecastStats/?reach_id=' + reachid + '&date=' + cdate + '&return_format=json', function (result) {

        fcastData = result;
        fcastData['cdate'] = cdate;

        $.each(fcastData.time_series.datetime, function (i, v) {
          fcastData.time_series.datetime[i] = new Date(v).getTime();
        })

        $.each(fcastData.time_series.datetime_high_res, function (j, d) {
          fcastData.time_series.datetime_high_res[j] = new Date(d).getTime();
        })

        forecastChart(_sname, fcastData);
        $('#fcast-loading').hide();
      })
    }
  }

  function forecastChart(stname, fdata) {

    var src = fdata.time_series;
    var avgseries = [];
    var minmaxseries = [];
    var percentileseries = [];
    var highseries = [];

    $.each(src.datetime, function (i, v) {
      avgseries.push([v, src['flow_avg_m^3/s'][i]]);
      minmaxseries.push([v, src['flow_min_m^3/s'][i], src['flow_max_m^3/s'][i]]);
      percentileseries.push([v, src['flow_25%_m^3/s'][i], src['flow_75%_m^3/s'][i]]);
    })

    $.each(src.datetime_high_res, function (i, v) {
      highseries.push([v, src['high_res'][i]]);

    })

    Highcharts.chart('streamflowChart', {
      credits: {
        enabled: false
      },
      chart: {
        zoomType: 'xy',
        type: 'spline',
        style: {
          "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif",
          "fontSize": "12px"
        },
      },
      title: {
        text: 'Forecasted Streamflow'
      },
      subtitle: {
        text: 'Station: ' + stname, //formatDate(stnData[stnid].data[0].receivedDate,'yy-MM-dd'),
        style: {
          "fontSize": "14px"
        }
      },
      xAxis: {
        title: {
          text: 'Date (UTC + 0:00)'
        },
        type: 'datetime',
        labels: {
          formatter: function () {
            return Highcharts.dateFormat('%b %e', this.value);
          }
        }

      },
      // scrollbar: {
      //   // barBackgroundColor: 'gray',
      //   barBorderRadius: 3,
      //   enabled: true
      // },
      plotOptions: {
        series: {
          pointWidth: 15, //width of the column bars irrespective of the chart size
          pointPadding: 0,
          groupPadding: 0,
        }
      },
      yAxis: {
        title: {
          useHTML: true,
          text: 'Streamflow (m<sup>3</sup>/s)'
        }
      },
      tooltip: {
        crosshairs: true,
        shared: true,
        useHTML: true,
        //valueSuffix: '°C'
      },

      legend: {
        //align: 'center',
        //verticalAlign: "bottom",
        //floating: true,
        //y: 30
        align: 'right',
        verticalAlign: "top",
        layout: "vertical",
        // symbolRadius: 0
      },
      series: [{
        name: 'Minimum & Maximum Flow',
        data: minmaxseries,
        type: 'arearange',
        lineWidth: 0,
        //linkedTo: ':previous',
        color: '#4282b0', //Highcharts.getOptions().colors[0],
        fillOpacity: 0.3,
        zIndex: 0,
        visible: false,
        marker: {
          enabled: false
        }
      },
      {
        name: '25-75 Percentile Flow',
        data: percentileseries,
        type: 'arearange',
        lineWidth: 0,
        //linkedTo: ':previous',
        color: '#BAEDC3', //Highcharts.getOptions().colors[0],
        fillOpacity: 0.9,
        zIndex: 0,
        marker: {
          enabled: false
        }
      },
      {
        name: 'High Resolution Forecast',
        data: highseries,
        zIndex: 1,
        color: '#000000',
        marker: {
          fillColor: 'white',
          lineWidth: 2,
          lineColor: '#4282b0', //Highcharts.getOptions().colors[0]
          enabled: false
        },
        tooltip: {
          valueSuffix: ' m<sup>3</sup>/s'
        }
      },
      {
        name: 'Average Flow',
        data: avgseries,
        zIndex: 1,
        color: '#4282b0',
        marker: {
          fillColor: 'white',
          lineWidth: 2,
          lineColor: '#4282b0', //Highcharts.getOptions().colors[0]
          enabled: false
        },
        tooltip: {
          valueSuffix: ' m<sup>3</sup>/s'
        }
      }
      ]
    })
  }

}


function findFeature(stnid) {
  var f = null;
  $.each(stationFeatures, function (i, fea) {
    if (fea.get('id') == stnid) {
      f = fea;
      return;
    }

  });
  return f;
}

var tileLayer = new ol.layer.Tile({
  source: new ol.source.OSM({
    wrapX: false,
  }),
});

function initMap() {

  overlay = new ol.Overlay({
    element: document.getElementById('popup'),
    autoPan: true,
    autoPanAnimation: {
      duration: 250
    }
  });

  map = new ol.Map({
    target: 'mapDiv',
    overlays: [overlay],
    layers: [tileLayer],
    view: new ol.View({
      center: ol.proj.fromLonLat([34.301525, -13.254308]),
      zoom: 7
    })
  });

  var btnReset = $('<button class="ol-zoom-out" type="button" title="Zoom out"><i class="fas fa-home"></i></button>').insertAfter($('.ol-zoom-in'));
  btnReset.click(resetZoom);

  addOutline();

  $('#popup-closer').click(function () {
    overlay.setPosition(undefined);
    $('#popup-closer').blur();
  })

  map.on('singleclick', function (evt) {

    activeFeature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
      return feature;
    });

    if (activeFeature == null)
      return;

    showOverlay(activeFeature);

    //select station item
    $('.data-listview .listitem.active').removeClass('active');
    $('#' + activeFeature.get('id')).addClass('active');
    $('.data-listview').scrollTop(0);
    $('.data-listview').scrollTop($('#' + activeFeature.get('id')).position().top - 122);
  });

}

function addOutline() {
  var geoJSONFormat = new ol.format.GeoJSON();
  var features = geoJSONFormat.readFeatures(outline, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  });
  var lay = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: features
    }),
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: [250, 250, 250, 0]
      }),
      stroke: new ol.style.Stroke({
        color: [0, 0, 0, 1],
        width: 1.2
      })
    })
  });

  map.addLayer(lay);
  // map.getLayers().insertAt(1, l);
  extent = lay.getSource().getExtent();
  resetZoom();
}

function resetZoom() {
  map.getView().fit(extent, {
    size: map.getSize(),
    padding: [10, 0, 10, 0],
    duration: 200
  });
}

function showOverlay(f) {

  if (f && f.get('type') == 'spoint') {
    //var data = filterData(pointFeatures, 'id', f.get('id')); 
    $('#popup-title').text(f.get('name')); //f.get('id') + ' - ' +
    $('#popup-content').html('');

    var dname = $('#selDistrict option[value=' + f.get('district') + ']').text();
    $('#popup-content').html('<div>District: <span style=font-weight:bold;>' + dname + '</span></div>' +
      '<div>Alert Level: <span style=font-weight:bold;>' + f.get('first_warning') + ' cm</span></div>' +
      '<div>Warning Level: <span style=font-weight:bold;>' + f.get('second_warning') + ' cm</span></div>'); //+
    //'<div>Station Height: <span style=font-weight:bold;>' + f.get('station_height')  + '</span></div>');

    var d = $('<div />').appendTo($('#popup-content')); //style="width:310px;"
    var btnViewChart = $('<span class="btn btn-custom" style="margin-top:15px;float:left;positon:absolute;"><i class="fas fa-chart-line"></i> View Chart</span>').appendTo(d);

    $('#popup').show();
    overlay.setPosition(f.getGeometry().getCoordinates());

    btnViewChart.click(function () {
      var b = $('.wlevel-option');
      $(b[0]).addClass('active');
      $(b[1]).removeClass('active');


      var tday = formatDate(new Date(), 'yy-mm-dd'); //formatDate($('#wlevelDate').datepicker('getDate'),'yy-mm-dd');
      $('#wlevelDate').datepicker('update', tday);
      // $('#rainDate').datepicker('update', tday);

      showChart(f, tday);
    })

    // var dwnld=$('<span class="btn btn-custom" style="margin:15px 15px 0 15px;float:right;position:absolute"><i class="fas fa-download"></i> Data Download</span>').appendTo(d);

  }
}

function showChart(f, cdate) {
  var csrftoken = $('[name=csrfmiddlewaretoken]').val();
  var stnid = f.get('id');
  var stnName = f.get('name');
  var fl = f.get('first_warning');
  var sl = f.get('second_warning');
  var low = f.get('low_level');
  var high = f.get('high_level');
  var coeff_c = f.get('coeff_c');
  var section_b = f.get('section_b');

  $('#stnid-chart').val(stnid);
  $('#dChart').show();
  // $('#dChart-title').text('Station: '+stnName);

  if (stnData[stnid] == null)
    stnData[stnid] = {
      data: {}
    };

  if (stnData[stnid].data[cdate] == null) {
    $.ajax({
      url: '/getStationData/?ID=' + stnid + '&fromDate=' + cdate + '&toDate=' + cdate,
      type: 'post',
      data: {},
      headers: {
        'X-CSRFToken': csrftoken
      },
      dataType: 'json',
      success: function (data) {
        if (data && data.length == 0)
          return;

        $.each(data, function (i, v) {
          // data[i].receivedDate= new Date(data[i].receivedDate)
          data[i].receivedDate = convertTZ(v.receivedDate, tzone);
        })

        stnData[stnid] = {
          data: {},
          stnName: stnName,
          alertLevel: fl,
          warningLevel: sl,
          low: low,
          high: high,
          coeff_c: coeff_c,
          section_b: section_b
        };
        stnData[stnid].data[cdate] = data;
      },
      complete: function (data) {
        if (data.status == 200) {
          drawWaterChart(stnid, cdate);
          drawDischargeChart(stnid, cdate);
        }

        drawRainfallChart(stnid, cdate);
      }
    });
  } else {
    drawWaterChart(stnid, cdate);
    drawRainfallChart(stnid, cdate);
    drawDischargeChart(stnid, cdate);
  }

}

function getColor(stnid, value) {
  var src = stnData[stnid];
  var col = '#0000ff'; //'#51ad0c';
  if (value >= src.alertLevel && value < src.warningLevel)
    col = '#e8b72b';
  else if (value >= src.warningLevel)
    col = '#ff0000';

  return col;
}

function drawDischargeChart(stnid, cdate) {
  var src = stnData[stnid];
  if (src.data[cdate] == null) {
    $('#dischargeChart').empty();
    $('#dischargeChart').append('<h3 style="text-align:center;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"><i class="fas fa-exclamation-triangle"></i> No data available.</h3>');
    return;
  }

  var pdata = [];
  $.each(src.data[cdate], function (l, g) {
    if (g.depthValue > -999 && g.isSpike == 0) {
      g.discharge = src.coeff_c * Math.pow(g.depthValue / 100, src.section_b);
      pdata.push(g);
    }

  })


  var sdata = [];
  var isHourly = false;
  if ($('.discharge-option.active').text() == 'Hourly')
    isHourly = true;

  if (isHourly) {
    //groupby hour
    var hrlyData = groupbyHour(pdata, 'receivedDate');

    //calculate hourly average
    $.each(hrlyData, function (k, v) {
      var avg = 0;
      $.each(v, function (i, d) {
        avg += d.discharge;
      })
      avg = parseFloat((avg / v.length).toFixed(3));
      sdata.push([k + ':00', avg, getColor(stnid, avg)]);
    })

  } else {
    $.each(pdata, function (i, v) {

      sdata.push([formatTime(v.receivedDate, 'hh:mm'), v.discharge, getColor(stnid, v.discharge)]);
      // sdata.push([v.receivedDate.getTime(),v.depthValue,getColor(stnid,v.depthValue)]);
    })
  }



  Highcharts.chart('dischargeChart', {
    credits: {
      enabled: false
    },
    chart: {
      zoomType: 'xy',
      type: 'spline',
      style: {
        "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif",
        "fontSize": "12px"
      },
    },
    title: {
      text: 'Discharge '
    },
    subtitle: {
      text: 'Station: ' + src.stnName, //formatDate(stnData[stnid].data[0].receivedDate,'yy-MM-dd'),
      style: {
        "fontSize": "14px"
      }
    },
    xAxis: {
      type: 'category',
      title: {
        text: 'Time (HH:MM)',
        margin: 30
      },
      // min: { myMin },
      // max: { myMax},
      labels: {
        rotation: -90,
        style: {
          fontSize: '11px'
        }
      }

    },
    scrollbar: {
      // barBackgroundColor: 'gray',
      barBorderRadius: 3,
      enabled: true
    },
    plotOptions: {
      series: {
        pointWidth: 15, //width of the column bars irrespective of the chart size
        pointPadding: 0,
        groupPadding: 0,
      }
    },
    yAxis: {
      // min: src.low,
      // max: src.high,
      title: {
        text: 'Discharge (cumec)'
      },
      // plotLines: [{
      //     color: '#FF0000',
      //     width: 2,
      //     dashStyle: 'shortdash',
      //     value: src.warningLevel,
      //     label: {
      //       text: 'Warning level'
      //     }
      //   },
      //   {
      //     color: '#e8b72b', //'#FFA500',
      //     width: 2,
      //     dashStyle: 'shortdash',
      //     value: src.alertLevel,
      //     label: {
      //       text: 'Alert level',
      //       y: 15
      //     }
      //   }
      // ]
    },
    tooltip: {
      formatter: function () {
        return 'Time: <b>' + this.key + '</b><br/>Discharge: <b>' + this.y.toFixed(3) + ' cumec</b>';
      }
    },
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'bottom',
      layout: "horizontal"
    },
    exporting: {
      enabled: true,
      buttons: {
        contextButton: {
          // align: 'left',
          y: 20
        }
      }
    },
    series: [{
      name: 'Water Level',
      keys: ['name', 'y', 'color'],
      data: sdata,
      dataLabels: {
        enabled: true,
        rotation: -90,
        align: 'left',
        // verticalAlign:'top',
        format: '{point.y:.3f}', // one decimal
        y: -5, // 10 pixels down from the top
        style: {
          fontSize: '11px',
          fontweight: 'bold',
          // fontFamily: 'Verdana, sans-serif'
        }
      }
    }]
  });
}

function drawWaterChart(stnid, cdate) {
  var src = stnData[stnid];
  if (src.data[cdate] == null) {
    $('#wlevelChart').empty();
    $('#wlevelChart').append('<h3 style="text-align:center;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"><i class="fas fa-exclamation-triangle"></i> No data available.</h3>');
    return;
  }

  var pdata = [];
  $.each(src.data[cdate], function (l, g) {
    if (g.depthValue > -999 && g.isSpike == 0)
      pdata.push(g);
  })


  var sdata = [];
  var isHourly = false;
  if ($('.wlevel-option.active').text() == 'Hourly')
    isHourly = true;

  if (isHourly) {
    //groupby hour
    var hrlyData = groupbyHour(pdata, 'receivedDate');

    //calculate hourly average
    $.each(hrlyData, function (k, v) {
      var avg = 0;
      $.each(v, function (i, d) {
        avg += d.depthValue;
      })
      avg = parseFloat((avg / v.length).toFixed(1));
      sdata.push([k + ':00', avg, getColor(stnid, avg)]);
    })

  } else {
    $.each(pdata, function (i, v) {

      sdata.push([formatTime(v.receivedDate, 'hh:mm'), v.depthValue, getColor(stnid, v.depthValue)]);
      // sdata.push([v.receivedDate.getTime(),v.depthValue,getColor(stnid,v.depthValue)]);
    })
  }



  Highcharts.chart('wlevelChart', {
    credits: {
      enabled: false
    },
    chart: {
      zoomType: 'xy',
      type: 'spline',
      style: {
        "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif",
        "fontSize": "12px"
      },
    },
    title: {
      text: 'Water Level '
    },
    subtitle: {
      text: 'Station: ' + src.stnName, //formatDate(stnData[stnid].data[0].receivedDate,'yy-MM-dd'),
      style: {
        "fontSize": "14px"
      }
    },
    xAxis: {
      type: 'category',
      title: {
        text: 'Time (HH:MM)',
        margin: 30
      },
      // min: { myMin },
      // max: { myMax},
      labels: {
        rotation: -90,
        style: {
          fontSize: '11px'
        }
      }

    },
    scrollbar: {
      // barBackgroundColor: 'gray',
      barBorderRadius: 3,
      enabled: true
    },
    plotOptions: {
      series: {
        pointWidth: 15, //width of the column bars irrespective of the chart size
        pointPadding: 0,
        groupPadding: 0,
      }
    },
    yAxis: {
      min: src.low,
      max: src.high,
      title: {
        text: 'Water Level (cm)'
      },
      plotLines: [{
        color: '#FF0000',
        width: 2,
        dashStyle: 'shortdash',
        value: src.warningLevel,
        label: {
          text: 'Warning level'
        }
      },
      {
        color: '#e8b72b', //'#FFA500',
        width: 2,
        dashStyle: 'shortdash',
        value: src.alertLevel,
        label: {
          text: 'Alert level',
          y: 15
        }
      }
      ]
    },
    tooltip: {
      formatter: function () {
        return 'Time: <b>' + this.key + '</b><br/>Water Level: <b>' + this.y + ' cm</b>';
      }
    },
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'bottom',
      layout: "horizontal"
    },
    exporting: {
      enabled: true,
      buttons: {
        contextButton: {
          // align: 'left',
          y: 20
        }
      }
    },
    series: [{
      name: 'Water Level',
      keys: ['name', 'y', 'color'],
      data: sdata,
      dataLabels: {
        enabled: true,
        rotation: -90,
        align: 'left',
        // verticalAlign:'top',
        format: '{point.y:.1f}', // one decimal
        y: -5, // 10 pixels down from the top
        style: {
          fontSize: '11px',
          fontweight: 'bold',
          // fontFamily: 'Verdana, sans-serif'
        }
      }
    }]
  });
}

function drawRainfallChart(stnid, cdate) {

  // if($('.classDiv').is(':empty'))
  // if($('#rainChart').is(':hidden'))
  //   return;

  var src = stnData[stnid];
  if (src.data[cdate] == null) {
    $('#rainChart').empty();
    $('#rainChart').append('<h3 style="text-align:center;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"><i class="fas fa-exclamation-triangle"></i> No data available.</h3>');
    return;
  }

  var sdata = [];
  var cumData = [];
  var _categories = [];

  var isHourly = false;
  if ($('.rain-option.active').text() == 'Hourly')
    isHourly = true;

  if (isHourly) {
    //groupby hour
    var hrlyData = groupbyHour(src.data[cdate], 'receivedDate');

    //calculate hourly average
    var ttl = 0;
    $.each(hrlyData, function (k, v) {
      var sum = 0;
      $.each(v, function (i, d) {
        sum += d.rainfall;
      })

      _categories.push(k + ':00');
      ttl += sum;
      cumData.push(ttl);
      sdata.push(sum);
    })

  } else {
    var _rain = 0;
    $.each(src.data[cdate], function (i, v) {
      _categories.push(formatTime(v.receivedDate, 'hh:mm'));
      _rain += v.rainfall;
      sdata.push(v.rainfall);
      cumData.push(_rain);
    })
  }

  Highcharts.chart('rainChart', {
    credits: {
      enabled: false
    },
    chart: {
      zoomType: 'xy',
      type: 'spline',
      style: {
        "fontFamily": "Lato,\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif",
        "fontSize": "12px"
      },
    },
    title: {
      text: 'Hourly Rainfall'
    },
    subtitle: {
      text: 'Station: ' + src.stnName, //formatDate(stnData[stnid].data[0].receivedDate,'yy-MM-dd'),
      style: {
        "fontSize": "14px"
      }
    },
    xAxis: [{
      categories: _categories,
      crosshair: true,
      title: {
        text: 'Time (HH:MM)',
        margin: 10
      },
      labels: {
        rotation: -90,
        style: {
          fontSize: '11px'
        }
      }
    }],
    scrollbar: {
      // barBackgroundColor: 'gray',
      barBorderRadius: 3,
      enabled: true
    },
    plotOptions: {
      series: {
        pointWidth: 15, //width of the column bars irrespective of the chart size
        pointPadding: 0,
        groupPadding: 0,
      }
    },
    yAxis: [{
      // Primary yAxis
      title: {
        text: 'Rainfall (mm)'
      }
    }],
    series: [{
      name: 'Rainfall Hourly',
      type: 'column',
      data: sdata,
      tooltip: {
        valueSuffix: ' mm'
      },

    },
    {
      name: 'Rainfall Cumulative',
      type: 'spline',
      data: cumData,
      tooltip: {
        valueSuffix: ' mm'
      },
      color: '#e8b72b',
      dataLabels: {
        enabled: true,
        rotation: -90,
        align: 'left',
        // verticalAlign:'top',
        format: '{point.y:.1f}', // one decimal
        y: -5, // 10 pixels down from the top
        style: {
          fontSize: '11px',
          fontweight: 'bold',
          // fontFamily: 'Verdana, sans-serif'
        }
      }
    }
    ]
  })
}

function loadStationPoints(data) {
  //var pointFeatures = [];

  $.each(data, function (k, v) {
    var lat = v.fields.lat;
    var lon = v.fields.lon;

    var attr = {
      id: v.fields.water_station,
      name: v.fields.name,
      reach_id: v.fields.reach_id,
      type: 'spoint',
      district: v.fields.district,
      station_height: v.fields.station_height,
      first_warning: v.fields.first_warning,
      second_warning: v.fields.second_warning,
      low_level: v.fields.low_level,
      high_level: v.fields.higer_level,
      coeff_c: v.fields.coeff_c,
      section_b: v.fields.section_b
    }
    attr.geometry = new ol.geom.Point(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'));

    var fea = new ol.Feature(attr);
    if (attr['id'] != null)
      fea.setId(attr['id']);

    fea.setStyle(st1);

    stationFeatures.push(fea);

  });


  stn_layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: stationFeatures
    }),
    // style: styles
  });

  map.addLayer(stn_layer);
  // map.getLayers().insertAt(1, f_layer);

  var hoverInteraction = new ol.interaction.Select({
    condition: ol.events.condition.pointerMove,
    layers: [stn_layer]
  });
  map.addInteraction(hoverInteraction);


}

var duration = 800;

function flash(feature) {
  var start = new Date().getTime();
  flashKeys.push(tileLayer.on('postrender', animate));

  var flashGeom = feature.getGeometry().clone();

  var vectorContext, frameState, elapsed, elapsedRatio, radius, opacity, style;

  function animate(event) {
    vectorContext = ol.render.getVectorContext(event);
    frameState = event.frameState;
    // var flashGeom = feature.getGeometry().clone();
    elapsed = frameState.time - start;
    elapsedRatio = elapsed / duration;
    // radius will be 5 at start and 30 at end.
    // var radius = ol.easing.easeOut(elapsedRatio) * 25 + 5;
    // var opacity = ol.easing.easeOut(1 - elapsedRatio);
    radius = ol.easing.easeOut(elapsedRatio) * 8 + 5;
    opacity = ol.easing.easeOut(1 - elapsedRatio);

    var style = new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius,
        stroke: new ol.style.Stroke({
          color: 'rgba(255, 0, 0, ' + opacity + ')',
          width: 0.5 + opacity,
        }),
      }),
    });

    vectorContext.setStyle(style);
    vectorContext.drawGeometry(flashGeom);
    if (elapsed > duration) {
      // ol.Observable.unByKey(listenerKey);
      start = new Date().getTime();
      // return;
    }
    // tell OpenLayers to continue postrender animation
    map.render();
  }
}