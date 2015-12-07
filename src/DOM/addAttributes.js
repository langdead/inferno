import template from './';
import eventMapping from '../shared/eventMapping';
import addListener from './events/addListener';
import { getValueWithIndex } from '../core/variables';

/**
 * Set HTML attributes on the template
 * @param{ HTMLElement } node
 * @param{ Object } attrs
 */
export function addDOMStaticAttributes(vNode, domNode, attrs) {
	for (let attrName in attrs) {
		const attrVal = attrs[attrName];

		if (attrVal) {
			template.setProperty(vNode, domNode, attrName, attrVal, false);
		}
	}
}

export function addDOMDynamicAttributes(item, domNode, dynamicAttrs) {
	for (let attrName in dynamicAttrs) {
		const attrVal = getValueWithIndex(item, dynamicAttrs[attrName]);

		if (attrVal) {
			if (eventMapping[attrName]) {
				addListener(item, domNode, eventMapping[attrName], attrVal);
			} else {
				template.setProperty(item, domNode, attrName, attrVal, true);
			}
		}
	}
}

export function updateDOMDynamicAttributes(lastItem, nextItem, domNode, dynamicAttrs) {
	for (let attrName in dynamicAttrs) {
		const lastAttrVal = getValueWithIndex(lastItem, dynamicAttrs[attrName]);
		const nextAttrVal = getValueWithIndex(nextItem, dynamicAttrs[attrName]);

		if (lastAttrVal !== nextAttrVal) {
			if (nextAttrVal) {
				if (eventMapping[attrName]) {
					addListener(nextItem, domNode, eventMapping[attrName], nextAttrVal);
				} else {
					template.setProperty(nextItem, domNode, attrName, nextAttrVal, true);
				}
			}
		}
	}
}