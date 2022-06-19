import type {DMMF} from '@prisma/generator-helper';

import {DataModel, QueryArg} from './parse';
import {Definition, ReservedName, SDL} from './converters/types';

import addTypeModifiers from './converters/addTypeModifiers';
import convertType from './converters/convertType';
import extractScalars from './extractors/extractScalars';
import formatDefinition from './formatters/formatDefinition';
import formatField from './formatters/formatField';
import formatScalar from './formatters/formatScalar';

import {formatPascal, removeExclamation, sdl} from './utils';

import type {Config} from './generateGraphqlSchema';

const getTypeConvertedFields = (
  model: DMMF.Model,
  config?: Config,
): DMMF.Field[] => {
  if (!model) {
    return [];
  }

  const shouldIgnore = model.fields.reduce(
    (acc: {[key: string]: boolean}, cur: DMMF.Field) => {
      const {relationFromFields} = cur;

      if (relationFromFields) {
        relationFromFields.forEach((field: string) => {
          acc[field] = true;
        });
      }

      return acc;
    },
    {},
  );

  const typeConvertedFields = model.fields.reduce(
    (collected: DMMF.Field[], field: DMMF.Field): DMMF.Field[] => {
      const {name} = field;

      if (shouldIgnore[name]) {
        return collected;
      }

      const applyCustomRulesBeforeTypeModifiersAddition = (
        f: DMMF.Field,
        m: DMMF.Model,
      ): DMMF.Field => {
        return convertType(f, m, config);
      };

      const applyCustomRulesAfterTypeModifiersAddition = (
        f: DMMF.Field,
        m: DMMF.Model,
      ): DMMF.Field => {
        return addTypeModifiers(f, m, config);
      };

      const transformers = [
        convertType,
        config?.customRules?.beforeAddingTypeModifiers &&
          applyCustomRulesBeforeTypeModifiersAddition,
        addTypeModifiers,
        config?.customRules?.afterAddingTypeModifiers &&
          applyCustomRulesAfterTypeModifiersAddition,
      ].filter(Boolean);

      try {
        const typeConvertedField = transformers.reduce((acc, transformer) => {
          return transformer!(acc, model);
        }, field);

        return [...collected, typeConvertedField];
      } catch {
        return collected;
      }
    },
    [],
  );

  return typeConvertedFields;
};

const transpile = (
  dataModel: DataModel,
  config?: Config,
  queryArgs?: QueryArg[],
): string => {
  const {models, enums, names} = dataModel;

  const queryFields = dataModel.names.reduce((acc: string[], name) => {
    const modelFields = getTypeConvertedFields(models[name], config);

    const {name: idName} = modelFields.find(({type}) => {
      if (typeof type !== 'string') {
        return false;
      }

      return type.match(SDL.ID);
    }) ?? {name: 'id'};

    const modelQueryArgs = queryArgs?.filter(
      (arg: QueryArg) => arg.name === name,
    );

    const queryFieldInput =
      modelQueryArgs
        ?.map((arg: QueryArg) => {
          return `${arg.field}: ${arg.name.toLowerCase()}${formatPascal(
            arg.field,
          )}QueryInput`;
        })
        .join(', ') || '';

    return [
      ...acc,
      `${name.toLowerCase()}(${idName}: ID!): ${name}`,
      `${name.toLowerCase()}s${
        queryFieldInput ? `(${queryFieldInput})` : ''
      }: [${name}!]!`,
    ];
  }, []);

  const queriesOfSchema = formatDefinition({
    type: Definition.type,
    name: ReservedName.Query,
    fields: queryFields,
  });

  const mutationFields = dataModel.names.reduce((acc: string[], name) => {
    const modelFields = getTypeConvertedFields(models[name], config);

    const {name: idName} = modelFields.find(({type}) => {
      if (typeof type !== 'string') {
        return false;
      }

      return type.match(SDL.ID);
    }) ?? {name: 'id'};

    const pascalName = formatPascal(name);

    return [
      ...acc,
      `create${pascalName}(${name.toLowerCase()}: ${name}CreateInput!): ${name}`,
      `update${pascalName}(${name.toLowerCase()}: ${name}UpdateInput!): ${name}`,
      `delete${pascalName}(${idName}: ID!): ${name}`,
    ];
  }, []);

  const mutationInputs = dataModel.names.reduce(
    (inputs: string[], modelName) => {
      const modelFields = getTypeConvertedFields(models[modelName], config);

      const fieldsWithoutID = modelFields.reduce(
        (fields: DMMF.Field[], cur) => {
          const {type} = cur;

          if (typeof type === 'string' && type.match(SDL.ID)) {
            return fields;
          }

          return [...fields, cur];
        },
        [],
      );

      const createInputFields = fieldsWithoutID.map(
        ({name, type}) => `${name}: ${type}`,
      );

      const updateInputFields = modelFields.map(
        ({name, type}) =>
          `${name}: ${removeExclamation(type as string).replace('ID', 'ID!')}`,
      );

      return [
        ...inputs,
        formatDefinition({
          type: Definition.input,
          name: `${modelName}CreateInput`,
          fields: createInputFields,
        }) +
          formatDefinition({
            type: Definition.input,
            name: `${modelName}UpdateInput`,
            fields: updateInputFields,
          }),
      ];
    },
    [],
  );

  const mutation = formatDefinition({
    type: Definition.type,
    name: ReservedName.Mutation,
    fields: mutationFields,
  });

  const mutationsOfSchema = mutationInputs + mutation;

  const scalars = extractScalars(dataModel);

  const scalarsOfSchema = scalars
    .map((scalar) => formatScalar(scalar))
    .join('');

  const enumsOfSchema = Object.entries(enums)
    .map(([name, anEnum]) => {
      const fields = anEnum.map(({name: field}) => `\t${field}`);

      return formatDefinition({
        type: Definition.enum,
        name,
        fields,
      });
    })
    .join('');

  const modelsOfSchema = names
    .map((name) => {
      const fields = getTypeConvertedFields(models[name], config).map((field) =>
        formatField(field),
      );

      return formatDefinition({
        type: Definition.type,
        name,
        fields,
      });
    })
    .join('');

  const getQueryArgInputFields = (type: string) => {
    if (type === 'Int')
      return [
        '_gt: Int',
        '_lt: Int',
        '_gte: Int',
        '_lte: Int',
        '_eq: Int',
        '_neq: Int',
        '_is_null: Boolean',
      ];
    if (type === 'Float')
      return [
        '_gt: Float',
        '_lt: Float',
        '_gte: Float',
        '_lte: Float',
        '_eq: Float',
        '_neq: Float',
        '_is_null: Boolean',
      ];
    if (type === 'DateTime')
      return [
        '_gt: DateTime',
        '_lt: DateTime',
        '_gte: DateTime',
        '_lte: DateTime',
        '_eq: DateTime',
        '_neq: DateTime',
        '_is_null: Boolean',
      ];
    return [
      '_eq: String',
      '_contains: String',
      '_is_empty: Boolean',
      '_in: [String]',
      '_not_in: [String]',
      '_is_null: Boolean',
    ];
  };

  const queryInputs: string =
    queryArgs
      ?.map((arg: QueryArg) => {
        return formatDefinition({
          type: Definition.input,
          name: `${arg.name.toLowerCase()}${formatPascal(arg.field)}QueryInput`,
          fields: getQueryArgInputFields(arg.type),
        });
      })
      .join('\n') || '';

  const schema =
    (config?.createQuery === 'true' ? queriesOfSchema : '') +
    (config?.createQuery === 'true' ? queryInputs : '') +
    (config?.createMutation === 'true' ? mutationsOfSchema : '') +
    scalarsOfSchema +
    enumsOfSchema +
    modelsOfSchema;

  return sdl(schema);
};

export default transpile;
