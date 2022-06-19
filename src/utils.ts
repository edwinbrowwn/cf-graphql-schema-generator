import {printSchema, buildSchema} from 'graphql';

export const sdl = (s: string): string => printSchema(buildSchema(s));

export const removeExclamation = (s: string): string => {
  if (s.match(/!$/)) {
    return s.slice(0, -1);
  }

  return s;
};

export const formatPascal = (inputString: string) => {
  return inputString.length === 1
    ? inputString[0].toUpperCase()
    : inputString[0].toUpperCase() +
        inputString
          .slice(1)
          .toLowerCase()
          .replace(/([-_][a-z])/g, (group) =>
            group.toUpperCase().replace('-', '').replace('_', ''),
          );
};
