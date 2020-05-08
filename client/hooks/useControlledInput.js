import React, { useEffect, useState } from 'react';
import { TextInput, TextAreaInput, ToggleSwitch, Select } from '@rocket.chat/fuselage';

export const ControlledTextInput = ({ name, initialValue, onUpdate = () => {}, ...props }) => {
	const [state, setState] = useState(initialValue);
	useEffect(() => onUpdate({ fieldName: name, initialValue, newValue: state }), [onUpdate, state]);

	const handleChange = (e) => {
		setState(e.currentTarget.value);
	};
	return <TextInput name={name} key={name} value={state} onChange={handleChange} {...props}/>;
};

export const ControlledTextAreaInput = ({ name, initialValue, onUpdate = () => {}, ...props }) => {
	const [state, setState] = useState(initialValue);
	useEffect(() => onUpdate({ fieldName: name, initialValue, newValue: state }), [onUpdate, state]);

	const handleChange = (e) => {
		setState(e.currentTarget.value);
	};
	return <TextAreaInput name={name} key={name} value={state} onChange={handleChange} {...props}/>;
};

export const ControlledToggleSwitch = ({ name, initialValue, onUpdate = () => {}, ...props }) => {
	const [state, setState] = useState(initialValue);
	useEffect(() => onUpdate({ fieldName: name, initialValue, newValue: state }), [onUpdate, state]);

	const handleChange = () => {
		setState(!state);
	};

	return <ToggleSwitch name={name} key={name} checked={state} onChange={handleChange} {...props}/>;
};

export const ControlledSelect = ({ name, initialValue, onUpdate = () => {}, options, ...props }) => {
	const [state, setState] = useState(initialValue);
	useEffect(() => onUpdate({ fieldName: name, initialValue, newValue: state }), [onUpdate, state]);

	const handleChange = (val) => {
		setState(val);
	};
	return <Select name={name} key={name} value={state} options={options} onChange={handleChange} {...props}/>;
};
