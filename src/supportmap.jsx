import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'

const serviceIcon = L.divIcon({
  className: 'service-map-marker',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const locationIcon = L.divIcon({
  className: 'location-map-marker',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function MapViewport({ location, places }) {
  const map = useMap()

  useEffect(() => {
    if (places.length === 0) {
      map.setView([location.latitude, location.longitude], 14)
      return
    }

    const bounds = L.latLngBounds([
      [location.latitude, location.longitude],
      ...places.map((place) => [place.lat, place.lon]),
    ])
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 })
  }, [location, map, places])

  return null
}

function SupportMap({ location, places, showLocation = true }) {
  return (
    <div className="support-map-region" role="region" aria-label="Map of nearby support services">
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={13}
        scrollWheelZoom={false}
        className="support-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showLocation && (
          <Marker
            position={[location.latitude, location.longitude]}
            icon={locationIcon}
          >
            <Popup>Your location</Popup>
          </Marker>
        )}
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lon]}
            icon={serviceIcon}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              <span>{place.type} · {place.distance.toFixed(1)} km</span>
            </Popup>
          </Marker>
        ))}
        <MapViewport location={location} places={places} />
      </MapContainer>
    </div>
  )
}

export default SupportMap
