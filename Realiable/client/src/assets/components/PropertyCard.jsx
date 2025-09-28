import React from 'react';

export default function PropertyCard({ property, onSelect }) {
	return (
		<div onClick={() => onSelect(property.id)} style={{ border: '1px solid #ddd', padding: 8, cursor: 'pointer' }}>
			<img src={(property.images && property.images[0]) || 'https://via.placeholder.com/200x140'} alt="thumb" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
			<div style={{ paddingTop: 8 }}>
				<strong>{property.title}</strong>
				<div>${property.price.toLocaleString()}</div>
				<div>{property.beds} bd • {property.baths} ba • {property.sqft} sqft</div>
			</div>
		</div>
	);
}

