const fuelPricePerLitre = 14; // سعر اللتر بالدرهم

window.onload = function() {
  let savedConsumption = localStorage.getItem("fuelConsumption");
  if (savedConsumption) {
    document.getElementById("fuelConsumption").value = savedConsumption;
    document.getElementById("engineConsumptionSection").style.display = "none";
    document.getElementById("editConsumptionBtn").style.display = "block";
  } else {
    document.getElementById("engineConsumptionSection").style.display = "block";
    document.getElementById("editConsumptionBtn").style.display = "none";
  }
  loadFuelLog();
  initMap();
};

function calculateDistance() {
    let fuelAmount = parseFloat(document.getElementById("fuelAmount").value);
    let fuelConsumption = parseFloat(document.getElementById("fuelConsumption").value);
    let currentOdometer = parseFloat(document.getElementById("currentOdometer").value);

    if (fuelAmount > 0 && fuelConsumption > 0) {
        let litresBought = fuelAmount / fuelPricePerLitre;
        let possibleDistance = litresBought * fuelConsumption;

        let resultText = `يمكنك القيادة لمسافة ${possibleDistance.toFixed(2)} كم بهذا البنزين.`;

        if (!isNaN(currentOdometer) && currentOdometer > 0) {
            let futureOdometer = currentOdometer + possibleDistance;
            resultText += `\n📍 العداد بعد استهلاك البنزين: ${futureOdometer.toFixed(0)} كم`;
        }

        document.getElementById("result").innerText = resultText;
        saveToFuelLog(possibleDistance, litresBought, fuelConsumption);
    } else {
        document.getElementById("result").innerText = "يرجى إدخال قيم صحيحة!";
    }
}

function calculateEngineConsumption() {
  let fuelAmountSpent = parseFloat(document.getElementById("fuelAmountSpent").value);
  let distanceDrivenSpent = parseFloat(document.getElementById("distanceDrivenSpent").value);

  if (fuelAmountSpent > 0 && distanceDrivenSpent > 0) {
    let litresBought = fuelAmountSpent / fuelPricePerLitre;
    let efficiency = distanceDrivenSpent / litresBought;
    
    localStorage.setItem("fuelConsumption", efficiency.toFixed(2));
    document.getElementById("fuelConsumption").value = efficiency.toFixed(2);
    document.getElementById("calculationResultSpent").innerText = `🚗 استهلاك المحرك: ${efficiency.toFixed(2)} كم/لتر`;
    
    saveToFuelLog(distanceDrivenSpent, litresBought, efficiency);
    
    document.getElementById("engineConsumptionSection").style.display = "none";
    document.getElementById("editConsumptionBtn").style.display = "block";
    
    alert(`✅ تم حساب استهلاك المحرك: ${efficiency.toFixed(2)} كم/لتر`);
  } else {
    alert("⚠️ المرجو إدخال قيم صحيحة!");
  }
}

function editConsumption() {
  document.getElementById("engineConsumptionSection").style.display = "block";
  document.getElementById("editConsumptionBtn").style.display = "none";
}

function saveToFuelLog(distance, fuel, efficiency) {
  let fuelLog = JSON.parse(localStorage.getItem("fuelLog")) || [];
  let logEntry = {
    date: new Date().toLocaleString(),
    distance: distance,
    fuel: fuel.toFixed(2),
    efficiency: efficiency.toFixed(2)
  };
  fuelLog.push(logEntry);
  localStorage.setItem("fuelLog", JSON.stringify(fuelLog));
  loadFuelLog();
}

function loadFuelLog() {
  let fuelLog = JSON.parse(localStorage.getItem("fuelLog")) || [];
  let logList = document.getElementById("fuelLog");
  logList.innerHTML = "";
  fuelLog.forEach(entry => {
    let listItem = document.createElement("li");
    listItem.innerText = `📅 ${entry.date} - 🏁 ${entry.distance} كم - ⛽ ${entry.fuel} لتر - 🔥 ${entry.efficiency} كم/لتر`;
    logList.appendChild(listItem);
  });
}

function clearFuelLog() {
    if (confirm("⚠️ هل أنت متأكد أنك تريد مسح سجل الاستهلاك؟")) {
        localStorage.removeItem("fuelLog");
        loadFuelLog();
        alert("🗑️ تم مسح السجل بنجاح!");
    }
}

function initMap() {
    var map = L.map('map').setView([33.5731, -7.5898], 13); // إحداثيات الدار البيضاء

    // يمكنك استبدال الرابط هنا برابط محلي لخرائط أو استعمال ملفات Offline إذا كنت متوفر
    L.tileLayer('file:///android_asset/tiles/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var userLocation = [position.coords.latitude, position.coords.longitude];

            L.marker(userLocation).addTo(map)
                .bindPopup('موقعك الحالي')
                .openPopup();

            map.setView(userLocation, 13);
            findNearestFuelStation(userLocation, map);
        });
    } else {
        alert("لا يمكن تحديد موقعك.");
    }
}

function findNearestFuelStation(userLocation, map) {
    const apiUrl = `https://nominatim.openstreetmap.org/search?lat=${userLocation[0]}&lon=${userLocation[1]}&radius=5000&format=json&amenity=fuel`;

    fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
            const nearestStation = data[0];
            L.marker([nearestStation.lat, nearestStation.lon])
                .addTo(map)
                .bindPopup(`أقرب محطة وقود: ${nearestStation.display_name}`)
                .openPopup();
        } else {
            alert("لم يتم العثور على محطات وقود قريبة.");
        }
    });
}

// كود تتبع الرحلة باستخدام GPS مع التنبيه عند اقتراب نفاد الوقود
let watchId;
let totalDistance = 0;
let lastPosition = null;
const fuelLimit = 10; // المسافة الممكنة بالوقود الحالي
const warningThreshold = 4; // المسافة التي يظهر عندها التنبيه

function startTracking() {
  totalDistance = 0;
  lastPosition = null;
  document.getElementById("distanceDisplay").innerText = "المسافة المقطوعة: 0 كم";

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(updatePosition, handleTrackingError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    });
  } else {
    alert("Geolocation غير مدعوم في هذا المتصفح.");
  }
}

function updatePosition(position) {
  let currentPosition = {
    lat: position.coords.latitude,
    lon: position.coords.longitude
  };

  if (lastPosition) {
    let distance = calculateHaversineDistance(lastPosition.lat, lastPosition.lon, currentPosition.lat, currentPosition.lon);
    totalDistance += distance;
    document.getElementById("distanceDisplay").innerText = "المسافة المقطوعة: " + totalDistance.toFixed(2) + " كم";

    if (fuelLimit - totalDistance <= warningThreshold) {
      alert("⚠️ تحذير: الوقود قارب على النفاد! تبقى لديك " + (fuelLimit - totalDistance).toFixed(2) + " كم فقط.");
      let audio = new Audio('alert.mp3');
      audio.play();
    }
  }

  lastPosition = currentPosition;
}

function stopTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    alert("🚗 انتهت الرحلة. المسافة المقطوعة: " + totalDistance.toFixed(2) + " كم");
    document.getElementById("distanceDisplay").innerText = "المسافة المقطوعة: 0 كم";
  }
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function handleTrackingError(error) {
  console.error("Error in tracking: ", error);
  alert("حدث خطأ في تتبع الموقع: " + error.message);
}
