import React, { useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import jsQR from 'jsqr';

import { decode } from 'jose/dist/browser/runtime/base64url';
import { createRemoteJWKSet } from 'jose/dist/browser/jwks/remote';
import { compactVerify } from 'jose/dist/browser/jws/compact/verify';

import { inflate } from 'pako';

function Vapor() {
	const canvasRef = useRef<HTMLCanvasElement | undefined>();

	const onChange = useCallback((e) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const file = e?.target?.files?.[0];
		if (!file) return;

		console.log(file);
		const url = URL.createObjectURL(file);
		console.log(url);

		const img = new Image();
		img.src = url;
		img.addEventListener('load', async () => {
			console.log(img.width, img.height);

			canvas.width = img.width;
			canvas.height = img.height;

			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, img.width, img.height);

			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

			console.log(imageData);

			const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
			if (!qrCode || !qrCode.data) return;

			const qrData = qrCode.data;
			console.log(qrData);
			if (!qrData.startsWith('shc:/')) return;

			let jws = '';
			for (let i = 5; i < qrData.length; i += 2) {
				jws += String.fromCharCode(parseInt(qrData.slice(i, i+2)) + 45);
			}

			const [header, payload, sig] = jws.split('.'));
			const inflated = JSON.parse(inflate(decode(payload), { raw: true, to: 'string' }));

			console.log(inflated);
			if (!inflated.iss) return;

			const keys = createRemoteJWKSet(new URL(inflated.iss + '/.well-known/jwks.json'));
			const res = await compactVerify(jws, keys);

			if (!res) return;

			const patient = inflated.vc.credentialSubject.fhirBundle.entry.find(entry => entry.resource.resourceType === 'Patient').resource;

			const doses = inflated.vc.credentialSubject.fhirBundle.entry.filter(entry => entry.resource.resourceType === 'Immunization').map(entry => entry.resource);

			console.log(patient, doses);

			const name = [...patient.name[0].given, patient.name[0].family].join(' ');
			console.log(name);
		});
	});

	return <>
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
			<input type="file" accept="image/*" capture="environment" onChange={onChange} />
			<canvas ref={canvasRef} />
		</div>
	</>;
}

ReactDOM.render(<Vapor />, document.getElementById('container'));
