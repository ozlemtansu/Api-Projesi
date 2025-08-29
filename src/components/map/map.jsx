import React, { useRef, useState, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, LayersControl, LayerGroup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import "../map/map.css"
import SearchBar from '../searchplace/SearchBar';

const Map = () => {
  const [geodata, setGeoData] = useState(null);
  const [pingData, setPingData] = useState([]); 
  const [deviceList, setDeviceList] = useState([]); // cihaz listesini tutacağız
  const position = [39.0, 35.0];

  // DeviceList'ten GeoJSON üret
  const convertToGeoJSON = (devices, pings) => {
    return {
      type: "FeatureCollection",
      features: devices
        .filter(item => item.enlem && item.boylam)
        .map(item => {
          const lat = parseFloat(item.enlem.toString().replace(",", "."));
          const lng = parseFloat(item.boylam.toString().replace(",", "."));
          if (isNaN(lat) || isNaN(lng)) return null;

          // Ping bilgisini bul
          const ping = pings.find(p => p.pingID === item.pingID);
          const status = ping ? ping.status : "unknown"; 

          return {
            type: "Feature",
            properties: {
              id: item.pingID,
              name: item.cihazAdi,
              ip: item.ip,
              tur: item.cihazTuru,
              status: status
            },
            geometry: {
              type: "Point",
              coordinates: [lng, lat]
            }
          };
        })
        .filter(Boolean)
    };
  };

  // DeviceList ve PingList'i çek
  useEffect(() => {
    fetch('http://10.50.10.14:81/DeviceList')
      .then(res => res.json())
      .then(devices => {
        setDeviceList(devices); // tablo için saklıyoruz
        fetch('http://10.50.10.14:81/PingList')
          .then(res => res.json())
          .then(pings => {
            setPingData(pings);
            const converted = convertToGeoJSON(devices, pings);
            setGeoData(converted);
          });
      })
      .catch(err => console.error('Failed to load data', err));
  }, []);

  // 5 dakikada bir PingList güncelle
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://10.50.10.14:81/PingList')
        .then(res => res.json())
        .then(pings => {
          setPingData(pings);
          setGeoData(prev => {
            if (!prev) return null;
            const devices = prev.features.map(f => ({
              pingID: f.properties.id,
              cihazAdi: f.properties.name,
              cihazTuru: f.properties.tur,
              ip: f.properties.ip,
              enlem: f.geometry.coordinates[1],
              boylam: f.geometry.coordinates[0]
            }));
            return convertToGeoJSON(devices, pings);
          });
        });
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  // Renkler
  const geoStyle = (feature) => {
    const status = feature.properties.status;
    return {
      fillColor: status === "up" ? "green" : "red",
      fillOpacity: 0.8,
      color: "black",
      weight: 1
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    if (!props) return;

    const popupContent = `
      <b>Cihaz Adı:</b> ${props.name}<br/>
      <b>Türü:</b> ${props.tur}<br/>
      <b>IP:</b> ${props.ip}<br/>
      <b>Durum:</b> ${props.status === "up" ? "✅ Up" : "❌ Down"}
    `;
    layer.bindPopup(popupContent);

    layer.bindTooltip(props.name || "No Name", {
      permanent: true,
      direction: "center",
      className: "geo-label"
    });
  };

  // tablo render
  const renderTable = () => {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "30px" }}>
        <thead>
          <tr style={{ background: "#f2f2f2" }}>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Cihaz Adı</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>IP</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Tür</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          {deviceList.map(dev => {
            const ping = pingData.find(p => p.pingID === dev.pingID);
            const status = ping ? ping.status : "unknown";
            return (
              <tr key={dev.pingID}>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{dev.cihazAdi}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{dev.ip}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{dev.cihazTuru}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px", fontWeight: "bold", color: status === "up" ? "green" : "red" }}>
                  {status}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ height: "600px" }}>
      <h4>Staj Projesi</h4>

      <MapContainer 
        center={position} 
        zoom={6} 
        scrollWheelZoom={true} 
        zoomControl={false}
        style={{ height: "70%", width: "100%" }}
      >
        <ZoomControl position="topright" />

        <LayersControl position='topright'>
          <LayersControl.BaseLayer checked name="Varsayılan Harita">
            <TileLayer attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Uydu Görüntüsü">
            <LayerGroup>
              <TileLayer attribution='Tiles &copy; Google &mdash; Source: Google'
                url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' />
              <TileLayer attribution='Labels &copy; Esri'
                url='https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' />
            </LayerGroup>
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Arazi Haritası">
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
        </LayersControl>

        {geodata && <GeoJSON data={geodata} style={geoStyle} onEachFeature={onEachFeature} />}
        <SearchBar />
      </MapContainer>

      {/* tablo burada */}
      {renderTable()}
    </div>
  );
};

export default Map;
