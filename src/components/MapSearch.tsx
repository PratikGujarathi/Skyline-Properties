import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { MapPin, DollarSign, Bed, Bath, Maximize, Loader2, Search } from 'lucide-react';
import { cn } from '../lib/utils';

interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  images: string[];
  lat?: number;
  lng?: number;
  area: string;
  city: string;
}

interface MapSearchProps {
  properties: Property[];
  onPropertyClick: (property: Property) => void;
  onBoundsChange?: (bounds: google.maps.LatLngBounds | null) => void;
}

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1.5rem',
};

const defaultCenter = {
  lat: 34.0522,
  lng: -118.2437,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

import { useAppContext } from '../contexts/AppContext';

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];

export const MapSearch: React.FC<MapSearchProps> = ({ properties, onPropertyClick, onBoundsChange }) => {
  const { theme } = useAppContext();
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchAsMove, setSearchAsMove] = useState(true);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleBoundsChanged = () => {
    if (map && searchAsMove && onBoundsChange) {
      onBoundsChange(map.getBounds());
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800">
        <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
        <p className="text-neutral-500 font-medium">Loading Interactive Map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={10}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          ...mapOptions,
          styles: theme === 'dark' ? darkMapStyles : mapOptions.styles
        }}
        onBoundsChanged={handleBoundsChanged}
      >
        <MarkerClusterer>
          {(clusterer) => (
            <>
              {properties.map((property) => (
                property.lat && property.lng && (
                  <Marker
                    key={property.id}
                    position={{ lat: property.lat, lng: property.lng }}
                    clusterer={clusterer}
                    onClick={() => setSelectedProperty(property)}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    }}
                  />
                )
              ))}
            </>
          )}
        </MarkerClusterer>

        {selectedProperty && (
          <InfoWindow
            position={{ lat: selectedProperty.lat!, lng: selectedProperty.lng! }}
            onCloseClick={() => setSelectedProperty(null)}
          >
            <div 
              className="p-2 max-w-[200px] cursor-pointer"
              onClick={() => onPropertyClick(selectedProperty)}
            >
              <div className="aspect-video rounded-lg overflow-hidden mb-2">
                <img 
                  src={selectedProperty.images[0]} 
                  alt={selectedProperty.title} 
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="font-bold text-neutral-900 text-sm truncate">{selectedProperty.title}</h4>
              <p className="text-gold font-black text-sm mb-1">${selectedProperty.price.toLocaleString()}</p>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {selectedProperty.bedrooms}</span>
                <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {selectedProperty.bathrooms}</span>
                <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> {selectedProperty.sqft}</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={() => setSearchAsMove(!searchAsMove)}
          className={cn(
            "px-4 py-2 rounded-full shadow-lg font-bold text-xs flex items-center gap-2 transition-all",
            searchAsMove 
              ? "bg-navy text-gold border border-gold/30" 
              : "bg-white text-neutral-600 border border-neutral-200"
          )}
        >
          <Search className="w-3 h-3" />
          {searchAsMove ? 'Search as I move' : 'Static Search'}
        </button>
      </div>
    </div>
  );
};
