alter table public.assignments
  drop constraint assignments_topics_check,
  add constraint assignments_topics_check check (
    cardinality(topics) between 1 and 10
    and topics <@ array[
      'Повторення матеріалу 1 класу',
      'Додавання і віднімання в межах 20',
      'Додавання двоцифрових чисел',
      'Віднімання двоцифрових чисел',
      'Числа, нумерація та порівняння',
      'Вирази й порядок дій',
      'Текстові задачі',
      'Величини та вимірювання',
      'Геометрія й периметр',
      'Множення та ділення'
    ]::text[]
    and public.has_unique_topics(topics)
  );
