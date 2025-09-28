import React, { useEffect, useState } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:4000/api' : '/api';

export default function PropertyList() {
	const [properties, setProperties] = useState([]);
	const [city, setCity] = useState('Blacksburg');
	const [minPrice, setMinPrice] = useState('');
	const [maxPrice, setMaxPrice] = useState('');
	const [beds, setBeds] = useState('');
	const [selected, setSelected] = useState(null);

	useEffect(() => {
		fetch(`${API}/properties?city=${encodeURIComponent(city)}&minPrice=${minPrice}&maxPrice=${maxPrice}&beds=${beds}`)
			.then(r => r.json())
			.then(setProperties)
			.catch(err => console.error(err));
	}, [city, minPrice, maxPrice, beds]);

	return (
		<div style={{ padding: 16 }}>
			<h2>Blacksburg properties</h2>
			<div style={{ marginBottom: 12 }}>
				<label>
					Min price <input value={minPrice} onChange={e => setMinPrice(e.target.value)} />
				</label>
				<label style={{ marginLeft: 8 }}>
					Max price <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
				</label>
				<label style={{ marginLeft: 8 }}>
					Beds <input value={beds} onChange={e => setBeds(e.target.value)} />
				</label>
			</div>

			<div style={{ display: 'flex', gap: 12 }}>
				<div style={{ flex: 1 }}>
					{properties.map(p => (
						<div key={p.id} onClick={() => setSelected(p.id)} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8, cursor: 'pointer' }}>
							<strong>{p.title}</strong>
							<div>{p.address}, {p.city}</div>
							<div>${p.price.toLocaleString()}</div>
						</div>
					))}
				</div>
				<div style={{ width: 600 }}>
					{selected ? <PropertyDetail id={selected} /> : <div>Select a property to view details</div>}
				</div>
			</div>
		</div>
	);
}

function PropertyDetail({ id }) {
	const [prop, setProp] = useState(null);
	useEffect(() => {
		fetch(`${API}/properties/${id}`).then(r => r.json()).then(setProp);
	}, [id]);
	if (!prop) return <div>Loading...</div>;
	return (
		<div style={{ border: '1px solid #ccc', padding: 12 }}>
			<h3>{prop.title} — ${prop.price.toLocaleString()}</h3>
			<img src={(prop.images && prop.images[0]) || prop.mapImage} alt="prop" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
			<p>{prop.description}</p>
			<div>Beds: {prop.beds} Baths: {prop.baths} Sqft: {prop.sqft}</div>
			<SchedulePanel propertyId={prop.id} />
		</div>
	);
}

function SchedulePanel({ propertyId }) {
	const [text, setText] = useState('');
	const [result, setResult] = useState(null);
	function submit() {
		fetch(`${API}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, propertyId }) }).then(r => r.json()).then(setResult);
	}
	return (
		<div style={{ marginTop: 12 }}>
			<h4>Does this house fit your schedule?</h4>
			<textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste timetable or write typical weekly schedule" style={{ width: '100%', height: 120 }} />
			<div style={{ marginTop: 8 }}>
				<button onClick={submit}>Analyze schedule</button>
			</div>
			{result && (
				<div style={{ marginTop: 12, background: '#fafafa', padding: 8 }}>
					<pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
				</div>
			)}
		</div>
	);
}

