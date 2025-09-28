import React, { useEffect, useState } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:4000/api' : '/api';

export default function PropertyDetail({ id }) {
	const [prop, setProp] = useState(null);
	useEffect(() => {
		fetch(`${API}/properties/${id}`).then(r => r.json()).then(setProp);
	}, [id]);
	if (!prop) return <div>Loading...</div>;
	return (
		<div style={{ padding: 8 }}>
			<h3>{prop.title}</h3>
				<img src={(prop.images && prop.images[0]) || (prop.mapImage && (import.meta.env.DEV ? `http://localhost:4000${prop.mapImage}` : prop.mapImage))} alt="prop" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
			<p>{prop.description}</p>
			<div>Address: {prop.address}, {prop.city}</div>
		</div>
	);
}
