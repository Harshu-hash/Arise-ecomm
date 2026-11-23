import React from 'react';
import renderer, { act } from 'react-test-renderer';
import StarRating from './StarRating';

jest.mock('react-native-vector-icons/FontAwesome', () => 'Icon');

// The gold overlay of each star is the absolutely positioned View whose width is the filled part.
const fills = rating => {
  let tree;
  act(() => {
    tree = renderer.create(<StarRating rating={rating} size={10} />);
  });
  return tree.root
    .findAll(node => node.type === 'View' && node.props.style?.some?.(s => s && s.position === 'absolute'))
    .map(node => node.props.style.find(s => s && s.width !== undefined).width);
};

describe('StarRating', () => {
  it('fills whole stars, then the fraction of the next one', () => {
    const filled = fills(4.3);
    expect(filled.slice(0, 4)).toEqual([10, 10, 10, 10]);
    expect(filled[4]).toBeCloseTo(3);
    expect(filled).toHaveLength(5);
    expect(fills(5)).toEqual([10, 10, 10, 10, 10]);
    expect(fills(0.5)).toEqual([5]);
  });
  it('draws nothing gold for no rating and nothing at all for a missing one', () => {
    expect(fills(0)).toEqual([]);
    let tree;
    act(() => {
      tree = renderer.create(<StarRating rating={null} />);
    });
    expect(tree.toJSON()).toBeNull();
  });
});
